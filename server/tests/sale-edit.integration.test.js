const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Pos = require("../services/pos.service");
const Settings = require("../services/settings.service");
const Sales = require("../services/sales.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouse = Number(
      db
        .prepare(
          "INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)",
        )
        .run(`Edit ${stamp}`).lastInsertRowid,
    );
    const userId = Number(
      db
        .prepare(
          "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)",
        )
        .run(`edit${stamp}`, "x", "Edit manager", warehouse).lastInsertRowid,
    );
    const actor = { id: userId, role: "manager", warehouse_id: warehouse };
    const editingCustomer = Number(
      db
        .prepare("INSERT INTO customers(name,is_active) VALUES(?,1)")
        .run(`Edit immediate customer ${stamp}`).lastInsertRowid,
    );
    const unit = Number(
      db
        .prepare("INSERT INTO units(name,symbol) VALUES(?,?)")
        .run(`Edit unit ${stamp}`, "pc").lastInsertRowid,
    );
    const product = Number(
      db
        .prepare(
          "INSERT INTO products(designation,unit_id,selling_price,track_stock) VALUES(?,?,100,1)",
        )
        .run("Edit product", unit).lastInsertRowid,
    );
    const productUnit = Number(
      db
        .prepare(
          "INSERT INTO product_units(product_id,unit_id,conversion_factor,selling_price,is_base) VALUES(?,?,1,100,1)",
        )
        .run(product, unit).lastInsertRowid,
    );
    db.prepare(
      "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,100)",
    ).run(product, warehouse);
    Settings.updateGroup(
      "sales",
      { allow_negative_stock: false, allow_price_edit: true },
      actor,
    );
    const line = {
      line_type: "PRODUCT",
      product_id: product,
      product_unit_id: productUnit,
      quantity: 5,
      unit_price: 100,
    };
    const sale = Pos.finalize(
      {
        client_request_id: `sale-${stamp}`,
        warehouse_id: warehouse,
        customer_id: editingCustomer,
        lines: [line],
        payments: [{ code: "CARD", amount: 500 }],
      },
      actor,
    );
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      95,
    );
    const payload = (request, quantity, extra = {}) => ({
      client_request_id: request,
      customer_id: sale.customer_id,
      fulfillment_type: "IMMEDIATE",
      lines: [{ ...line, id: sale.lines[0].id, quantity }],
      global_discount_type: "PERCENT",
      global_discount_value: 0,
      ...extra,
    });
    let edited = Pos.editSale(sale.id, payload(`increase-${stamp}`, 7), actor);
    assert.equal(edited.sale_number, sale.sale_number);
    assert.equal(edited.total, 700);
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      93,
    );
    assert.equal(
      db
        .prepare("SELECT COUNT(*) count FROM sale_payments WHERE sale_id=?")
        .get(sale.id).count,
      1,
    );
    edited = Pos.editSale(sale.id, payload(`decrease-${stamp}`, 3), actor);
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      97,
    );
    const movementCount = db
      .prepare(
        "SELECT COUNT(*) count FROM stock_movements WHERE reference_type='SALE_EDIT'",
      )
      .get().count;
    Pos.editSale(sale.id, payload(`decrease-${stamp}`, 3), actor);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) count FROM stock_movements WHERE reference_type='SALE_EDIT'",
        )
        .get().count,
      movementCount,
    );
    edited = Pos.editSale(
      sale.id,
      payload(`customer-only-${stamp}`, 3, { customer_reference: "UPDATED" }),
      actor,
    );
    assert.equal(edited.customer_reference, "UPDATED");
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      97,
    );
    edited = Pos.editSale(
      sale.id,
      {
        ...payload(`remove-${stamp}`, 3),
        lines: [
          {
            line_type: "MISC",
            designation: "Service",
            unit_name: "Unité",
            quantity: 1,
            unit_price: 50,
          },
        ],
      },
      actor,
    );
    assert.equal(edited.total, 50);
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      100,
    );
    assert.equal(
      db
        .prepare("SELECT SUM(amount) amount FROM sale_payments WHERE sale_id=?")
        .get(sale.id).amount,
      500,
    );
    assert.equal(
      Sales.detail(sale.id, actor).payment_summary.credit_amount,
      450,
    );

    const customer = Number(
      db
        .prepare("INSERT INTO customers(name,is_active) VALUES(?,1)")
        .run(`Edit customer ${stamp}`).lastInsertRowid,
    );
    const shipping = Pos.finalize(
      {
        client_request_id: `shipping-${stamp}`,
        warehouse_id: warehouse,
        customer_id: customer,
        fulfillment_type: "SHIPPING",
        lines: [line],
        payments: [],
        leave_unpaid: true,
      },
      actor,
    );
    const beforeShippingStock = db
      .prepare(
        "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
      )
      .get(product, warehouse).quantity;
    const shippingEdited = Pos.editSale(
      shipping.id,
      {
        client_request_id: `shipping-edit-${stamp}`,
        customer_id: customer,
        fulfillment_type: "SHIPPING",
        lines: [{ ...line, id: shipping.lines[0].id, quantity: 7 }],
      },
      actor,
    );
    assert.equal(shippingEdited.total, 700);
    assert.equal(
      db
        .prepare("SELECT quantity FROM delivery_lines WHERE delivery_id=?")
        .get(shipping.deliveries[0].id).quantity,
      7,
    );
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      beforeShippingStock,
    );
    db.prepare("UPDATE deliveries SET status='SHIPPED' WHERE id=?").run(
      shipping.deliveries[0].id,
    );
    assert.throws(
      () =>
        Pos.editSale(
          shipping.id,
          {
            client_request_id: `shipped-${stamp}`,
            customer_id: customer,
            fulfillment_type: "SHIPPING",
            lines: [{ ...line, id: shipping.lines[0].id, quantity: 8 }],
          },
          actor,
        ),
      /déjà été expédiée/,
    );

    const returnedSale = Pos.finalize(
      {
        client_request_id: `returned-${stamp}`,
        warehouse_id: warehouse,
        lines: [line],
        payments: [{ code: "CARD", amount: 500 }],
      },
      actor,
    );
    const returnId = Number(
      db
        .prepare(
          "INSERT INTO sales_returns(client_request_id,return_number,sale_id,warehouse_id,return_date,status,validated_by,created_by) VALUES(?,?,?,?,?,'VALIDATED',?,?)",
        )
        .run(
          `return-${stamp}`,
          `RET-${stamp}`,
          returnedSale.id,
          warehouse,
          new Date().toISOString().slice(0, 10),
          userId,
          userId,
        ).lastInsertRowid,
    );
    db.prepare(
      "INSERT INTO sales_return_lines(return_id,sale_line_id,product_id,designation,unit_name,quantity,unit_price,total) VALUES(?,?,?,?,?,?,?,?)",
    ).run(
      returnId,
      returnedSale.lines[0].id,
      product,
      "Edit product",
      "pc",
      2,
      100,
      200,
    );
    assert.throws(
      () =>
        Pos.editSale(
          returnedSale.id,
          {
            client_request_id: `below-return-${stamp}`,
            fulfillment_type: "IMMEDIATE",
            lines: [{ ...line, id: returnedSale.lines[0].id, quantity: 1 }],
          },
          actor,
        ),
      /déjà retournée/,
    );

    const serialProduct = Number(
        db
          .prepare(
            "INSERT INTO products(designation,unit_id,selling_price,track_stock,track_serials) VALUES(?,?,100,1,1)",
          )
          .run(`Serialized edit product ${stamp}`, unit).lastInsertRowid,
      ),
      serialUnit = Number(
        db
          .prepare(
            "INSERT INTO product_units(product_id,unit_id,conversion_factor,selling_price,is_base) VALUES(?,?,1,100,1)",
          )
          .run(serialProduct, unit).lastInsertRowid,
      );
    db.prepare(
      "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,2)",
    ).run(serialProduct, warehouse);
    const serialOne = Number(
        db
          .prepare(
            "INSERT INTO stock_serials(product_id,warehouse_id,serial_number) VALUES(?,?,?)",
          )
          .run(serialProduct, warehouse, `SER-1-${stamp}`).lastInsertRowid,
      ),
      serialTwo = Number(
        db
          .prepare(
            "INSERT INTO stock_serials(product_id,warehouse_id,serial_number) VALUES(?,?,?)",
          )
          .run(serialProduct, warehouse, `SER-2-${stamp}`).lastInsertRowid,
      );
    const serializedSale = Pos.finalize(
      {
        client_request_id: `serialized-sale-${stamp}`,
        warehouse_id: warehouse,
        customer_id: editingCustomer,
        leave_unpaid: true,
        lines: [
          {
            line_type: "PRODUCT",
            product_id: serialProduct,
            product_unit_id: serialUnit,
            quantity: 1,
            unit_price: 100,
            serial_ids: [serialOne],
          },
        ],
        payments: [],
      },
      actor,
    );
    const serializedIncreased = Pos.editSale(
      serializedSale.id,
      {
        client_request_id: `serialized-increase-${stamp}`,
        customer_id: editingCustomer,
        fulfillment_type: "IMMEDIATE",
        lines: [
          {
            id: serializedSale.lines[0].id,
            line_type: "PRODUCT",
            product_id: serialProduct,
            product_unit_id: serialUnit,
            quantity: 2,
            unit_price: 100,
            serial_ids: [serialOne, serialTwo],
          },
        ],
      },
      actor,
    );
    assert.deepEqual(
      new Set(serializedIncreased.lines[0].serial_ids),
      new Set([serialOne, serialTwo]),
    );
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(serialProduct, warehouse).quantity,
      0,
    );
    const serializedDecreased = Pos.editSale(
      serializedSale.id,
      {
        client_request_id: `serialized-decrease-${stamp}`,
        customer_id: editingCustomer,
        fulfillment_type: "IMMEDIATE",
        lines: [
          {
            id: serializedSale.lines[0].id,
            line_type: "PRODUCT",
            product_id: serialProduct,
            product_unit_id: serialUnit,
            quantity: 1,
            unit_price: 100,
            serial_ids: [serialOne],
          },
        ],
      },
      actor,
    );
    assert.deepEqual(serializedDecreased.lines[0].serial_ids, [serialOne]);
    assert.equal(
      db.prepare("SELECT status FROM stock_serials WHERE id=?").get(serialTwo)
        .status,
      "AVAILABLE",
    );
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(serialProduct, warehouse).quantity,
      1,
    );

    const batchProduct = Number(
        db
          .prepare(
            "INSERT INTO products(designation,unit_id,selling_price,track_stock,track_batches,track_expiration) VALUES(?,?,50,1,1,1)",
          )
          .run(`Batch edit product ${stamp}`, unit).lastInsertRowid,
      ),
      batchUnit = Number(
        db
          .prepare(
            "INSERT INTO product_units(product_id,unit_id,conversion_factor,selling_price,is_base) VALUES(?,?,1,50,1)",
          )
          .run(batchProduct, unit).lastInsertRowid,
      );
    db.prepare(
      "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,10)",
    ).run(batchProduct, warehouse);
    const batchId = Number(
      db
        .prepare(
          "INSERT INTO stock_batches(product_id,warehouse_id,batch_number,expiration_date,quantity) VALUES(?,?,?,?,10)",
        )
        .run(batchProduct, warehouse, `LOT-${stamp}`, "2099-12-31")
        .lastInsertRowid,
    );
    const batchSale = Pos.finalize(
      {
        client_request_id: `batch-sale-${stamp}`,
        warehouse_id: warehouse,
        customer_id: editingCustomer,
        leave_unpaid: true,
        lines: [
          {
            line_type: "PRODUCT",
            product_id: batchProduct,
            product_unit_id: batchUnit,
            quantity: 4,
            unit_price: 50,
            batch_id: batchId,
          },
        ],
        payments: [],
      },
      actor,
    );
    const editBatch = (request, quantity) =>
      Pos.editSale(
        batchSale.id,
        {
          client_request_id: request,
          customer_id: editingCustomer,
          fulfillment_type: "IMMEDIATE",
          lines: [
            {
              id: batchSale.lines[0].id,
              line_type: "PRODUCT",
              product_id: batchProduct,
              product_unit_id: batchUnit,
              quantity,
              unit_price: 50,
              batch_id: batchId,
            },
          ],
        },
        actor,
      );
    editBatch(`batch-increase-${stamp}`, 6);
    assert.equal(
      db.prepare("SELECT quantity FROM stock_batches WHERE id=?").get(batchId)
        .quantity,
      4,
    );
    const batchDecreased = editBatch(`batch-decrease-${stamp}`, 2);
    assert.equal(batchDecreased.lines[0].batch_allocations[0].quantity, 2);
    assert.equal(
      db.prepare("SELECT quantity FROM stock_batches WHERE id=?").get(batchId)
        .quantity,
      8,
    );
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log(
  "Sale edit integration test passed (stock differences, payments and idempotency).",
);
