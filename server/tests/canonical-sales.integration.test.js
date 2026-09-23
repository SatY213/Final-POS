const assert = require("node:assert/strict"),
  db = require("../config/database"),
  Pos = require("../services/pos.service"),
  Deliveries = require("../services/delivery.service"),
  Sales = require("../services/sales.service"),
  Settings = require("../services/settings.service");
require("../database/migrations/init");
let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now(),
      warehouse = Number(
        db
          .prepare(
            "INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)",
          )
          .run(`Canonical ${stamp}`).lastInsertRowid,
      ),
      user = Number(
        db
          .prepare(
            "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)",
          )
          .run(`canonical${stamp}`, "x", "Canonical", warehouse)
          .lastInsertRowid,
      ),
      actor = { id: user, role: "manager", warehouse_id: warehouse },
      customer = Number(
        db
          .prepare("INSERT INTO customers(name,is_active) VALUES(?,1)")
          .run(`Client ${stamp}`).lastInsertRowid,
      ),
      unit = Number(
        db
          .prepare("INSERT INTO units(name,symbol) VALUES(?,?)")
          .run(`Unit ${stamp}`, "u").lastInsertRowid,
      ),
      product = Number(
        db
          .prepare(
            "INSERT INTO products(designation,unit_id,track_stock) VALUES(?,?,1)",
          )
          .run("Canonical product", unit).lastInsertRowid,
      ),
      productUnit = Number(
        db
          .prepare(
            "INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base) VALUES(?,?,1,50,100,1)",
          )
          .run(product, unit).lastInsertRowid,
      );
    db.prepare(
      "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,20)",
    ).run(product, warehouse);
    Settings.updateGroup(
      "sales",
      { default_customer_id: customer, allow_default_customer: true },
      actor,
    );
    assert.equal(Pos.context(actor, warehouse).default_customer.id, customer);
    const line = {
      product_id: product,
      product_unit_id: productUnit,
      quantity: 2,
      unit_price: 100,
    };
    const immediate = Pos.finalize(
      {
        client_request_id: `immediate-${stamp}`,
        warehouse_id: warehouse,
        customer_id: customer,
        fulfillment_type: "IMMEDIATE",
        lines: [line],
        payments: [{ code: "CARD", amount: 200 }],
      },
      actor,
    );
    assert.match(immediate.sale_number, /^VNT-/);
    assert.equal(immediate.fulfillment_type, "IMMEDIATE");
    assert.equal(immediate.sale_status, "CONFIRMED");
    assert.equal(immediate.payment_status, "PAID");
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      18,
    );
    assert.equal(
      db
        .prepare("SELECT COUNT(*) count FROM deliveries WHERE sale_id=?")
        .get(immediate.id).count,
      0,
    );
    assert.equal(
      Pos.finalize(
        {
          client_request_id: `immediate-${stamp}`,
          warehouse_id: warehouse,
          lines: [],
          payments: [],
        },
        actor,
      ).id,
      immediate.id,
    );
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      18,
    );
    const shipping = Pos.finalize(
        {
          client_request_id: `shipping-${stamp}`,
          warehouse_id: warehouse,
          customer_id: customer,
          fulfillment_type: "SHIPPING",
          lines: [{ ...line, quantity: 3 }],
          payments: [{ code: "CARD", amount: 100 }],
          leave_unpaid: true,
        },
        actor,
      ),
      delivery = shipping.deliveries[0];
    assert.equal(shipping.payment_status, "PARTIALLY_PAID");
    assert.equal(delivery.status, "PREPARED");
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      18,
    );
    const shipped = Deliveries.ship(delivery.id, actor);
    assert.equal(shipped.status, "SHIPPED");
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      15,
    );
    const movementCount = db
      .prepare(
        "SELECT COUNT(*) count FROM stock_movements WHERE reference_type='SALE' AND reference_id=?",
      )
      .get(String(shipping.id)).count;
    assert.equal(Deliveries.ship(delivery.id, actor).status, "SHIPPED");
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) count FROM stock_movements WHERE reference_type='SALE' AND reference_id=?",
        )
        .get(String(shipping.id)).count,
      movementCount,
    );
    assert.equal(Deliveries.deliver(delivery.id, actor).status, "DELIVERED");
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      15,
    );
    const unpaid = Pos.finalize(
      {
        client_request_id: `unpaid-${stamp}`,
        warehouse_id: warehouse,
        customer_id: customer,
        fulfillment_type: "SHIPPING",
        lines: [{ ...line, quantity: 1 }],
        payments: [],
        leave_unpaid: true,
      },
      actor,
    );
    assert.equal(unpaid.payment_status, "UNPAID");
    assert.equal(unpaid.deliveries[0].status, "PREPARED");
    const directlyShipped = Pos.finalize(
      {
        client_request_id: `direct-shipping-${stamp}`,
        warehouse_id: warehouse,
        customer_id: customer,
        fulfillment_type: "SHIPPING",
        delivery_status: "SHIPPED",
        lines: [{ ...line, quantity: 1 }],
        payments: [{ code: "CARD", amount: 100 }],
      },
      actor,
    );
    assert.equal(directlyShipped.deliveries[0].status, "SHIPPED");
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      14,
    );
    const unspecifiedCustomer = Pos.finalize(
      {
        client_request_id: `unspecified-${stamp}`,
        warehouse_id: warehouse,
        customer_id: null,
        fulfillment_type: "IMMEDIATE",
        lines: [{ ...line, quantity: 1 }],
        payments: [{ code: "CARD", amount: 100 }],
      },
      actor,
    );
    assert.equal(unspecifiedCustomer.customer_id, null);
    assert.equal(
      Sales.list({ warehouse_id: warehouse }, actor).summary.count,
      5,
    );
    const saleProfiles = Settings.profiles().filter((p) =>
      [
        "SALE",
        "SALE_RECEIPT",
        "COUNTER_SALE",
        "SALE_INVOICE",
        "DELIVERY_NOTE",
      ].includes(p.document_type),
    );
    assert.deepEqual(
      saleProfiles.map((p) => p.document_type),
      ["SALE_INVOICE"],
    );
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log(
  "Canonical sales integration test passed (transaction rolled back).",
);
