const assert = require("node:assert/strict"),
  db = require("../config/database");
require("../database/migrations/init");
const Pos = require("../services/pos.service"),
  Settings = require("../services/settings.service");
let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now(),
      warehouse = Number(
        db
          .prepare(
            "INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)",
          )
          .run(`POS Test ${stamp}`).lastInsertRowid,
      ),
      user = Number(
        db
          .prepare(
            "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'cashier',?)",
          )
          .run(`pos${stamp}`, "x", "POS Cashier", warehouse).lastInsertRowid,
      ),
      actor = { id: user, role: "cashier", warehouse_id: warehouse };
    const register = Number(
        db
          .prepare(
            "INSERT INTO cash_registers(warehouse_id,name,code) VALUES(?,?,?)",
          )
          .run(warehouse, "POS Register", `POS-${stamp}`).lastInsertRowid,
      ),
      session = Number(
        db
          .prepare(
            "INSERT INTO cash_sessions(cash_register_id,user_id,opening_cash) VALUES(?,?,1000)",
          )
          .run(register, user).lastInsertRowid,
      ),
      unit = Number(
        db
          .prepare("INSERT INTO units(name,symbol) VALUES(?,?)")
          .run(`Piece ${stamp}`, "pc").lastInsertRowid,
      );
    const product = Number(
        db
          .prepare(
            "INSERT INTO products(designation,reference,unit_id,selling_price,track_stock) VALUES(?,?,?,?,1)",
          )
          .run("Test Product", `P-${stamp}`, unit, 100).lastInsertRowid,
      ),
      base = Number(
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
      {
        allow_negative_stock: false,
        allow_price_edit: false,
        allow_discount: true,
        max_discount_percent: 20,
      },
      actor,
    );
    Settings.updateGroup(
      "payments",
      {
        default_method: "CASH",
      },
      actor,
    );
    const productLine = {
      line_type: "PRODUCT",
      product_id: product,
      product_unit_id: base,
      designation: "ignored",
      quantity: 2,
      unit_price: 100,
      discount_percent: 0,
    };
    const cash = Pos.finalize(
      {
        client_request_id: `cash-${stamp}`,
        warehouse_id: warehouse,
        document_type: "SALE_RECEIPT",
        lines: [productLine],
        payments: [{ code: "CASH", amount: 200, amount_received: 250 }],
      },
      actor,
    );
    assert.equal(cash.total, 200);
    assert.equal(cash.payments[0].change_amount, 50);
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      98,
    );
    assert.equal(
      db
        .prepare(
          "SELECT amount FROM cash_movements WHERE reference_type='SALE' AND reference_id=?",
        )
        .get(cash.id).amount,
      200,
    );
    assert.equal(
      Pos.finalize(
        {
          client_request_id: `cash-${stamp}`,
          warehouse_id: warehouse,
          lines: [productLine],
          payments: [{ code: "CASH", amount: 200 }],
        },
        actor,
      ).id,
      cash.id,
    );
    const beforeCash = db
      .prepare("SELECT COUNT(*) count FROM cash_movements")
      .get().count;
    const card = Pos.finalize(
      {
        client_request_id: `card-${stamp}`,
        warehouse_id: warehouse,
        lines: [{ ...productLine, quantity: 1 }],
        payments: [{ code: "CARD", amount: 100 }],
      },
      actor,
    );
    assert.equal(card.payments[0].cash_session_id, null);
    assert.equal(
      db.prepare("SELECT COUNT(*) count FROM cash_movements").get().count,
      beforeCash,
    );
    const mixed = Pos.finalize(
      {
        client_request_id: `mixed-${stamp}`,
        warehouse_id: warehouse,
        customer_id: null,
        global_discount_percent: 10,
        lines: [
          {
            line_type: "MISC",
            designation: "Misc",
            unit_name: "Unit",
            quantity: 1,
            unit_price: 100,
            discount_percent: 10,
          },
          {
            line_type: "SERVICE",
            designation: "Service",
            unit_name: "Hour",
            quantity: 1,
            unit_price: 100,
          },
        ],
        payments: [{ code: "CASH", amount: 171, amount_received: 171 }],
      },
      actor,
    );
    assert.equal(mixed.total, 171);
    assert.equal(mixed.lines.filter((l) => l.product_id === null).length, 2);
    const cartonUnit = Number(
        db
          .prepare("INSERT INTO units(name,symbol) VALUES(?,?)")
          .run(`Carton ${stamp}`, "ct").lastInsertRowid,
      ),
      carton = Number(
        db
          .prepare(
            "INSERT INTO product_units(product_id,unit_id,conversion_factor,selling_price,is_base) VALUES(?,?,24,2400,0)",
          )
          .run(product, cartonUnit).lastInsertRowid,
      );
    Pos.finalize(
      {
        client_request_id: `pack-${stamp}`,
        warehouse_id: warehouse,
        lines: [
          {
            ...productLine,
            product_unit_id: carton,
            quantity: 2,
            unit_price: 2400,
          },
        ],
        payments: [{ code: "CARD", amount: 4800 }],
      },
      actor,
    );
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      49,
    );
    const draft = Pos.suspend(
      { warehouse_id: warehouse, lines: [{ ...productLine, quantity: 1 }] },
      actor,
    );
    assert.equal(draft.sale_status, "DRAFT");
    assert.equal(
      Pos.suspended(actor, warehouse).some((s) => s.id === draft.id),
      true,
    );
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(product, warehouse).quantity,
      49,
    );
    assert.throws(
      () =>
        Pos.finalize(
          {
            client_request_id: `bad-price-${stamp}`,
            warehouse_id: warehouse,
            lines: [{ ...productLine, unit_price: 50 }],
            payments: [{ code: "CARD", amount: 100 }],
          },
          actor,
        ),
      /Price editing/,
    );
    Settings.updateGroup("sales", { allow_negative_stock: true }, actor);
    const lowProduct = Number(
        db
          .prepare(
            "INSERT INTO products(designation,unit_id,selling_price,track_stock) VALUES(?,?,10,1)",
          )
          .run("Low", unit).lastInsertRowid,
      ),
      lowUnit = Number(
        db
          .prepare(
            "INSERT INTO product_units(product_id,unit_id,conversion_factor,selling_price,is_base) VALUES(?,?,1,10,1)",
          )
          .run(lowProduct, unit).lastInsertRowid,
      );
    db.prepare("INSERT INTO product_stock VALUES(?,?,1)").run(
      lowProduct,
      warehouse,
    );
    Pos.finalize(
      {
        client_request_id: `negative-${stamp}`,
        warehouse_id: warehouse,
        lines: [
          {
            line_type: "PRODUCT",
            product_id: lowProduct,
            product_unit_id: lowUnit,
            quantity: 2,
            unit_price: 10,
          },
        ],
        payments: [{ code: "CARD", amount: 20 }],
      },
      actor,
    );
    assert.equal(
      db
        .prepare(
          "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
        )
        .get(lowProduct, warehouse).quantity,
      -1,
    );

    const batchProduct = Number(
        db
          .prepare(
            "INSERT INTO products(designation,unit_id,selling_price,track_stock,track_batches,track_expiration) VALUES(?,?,10,1,1,1)",
          )
          .run("Batch Product", unit).lastInsertRowid,
      ),
      batchUnit = Number(
        db
          .prepare(
            "INSERT INTO product_units(product_id,unit_id,conversion_factor,selling_price,is_base) VALUES(?,?,1,10,1)",
          )
          .run(batchProduct, unit).lastInsertRowid,
      );
    db.prepare("INSERT INTO product_stock VALUES(?,?,10)").run(
      batchProduct,
      warehouse,
    );
    const expiredBatch = Number(
        db
          .prepare(
            "INSERT INTO stock_batches(product_id,warehouse_id,batch_number,expiration_date,quantity) VALUES(?,?,?,'2000-01-01',5)",
          )
          .run(batchProduct, warehouse, "OLD").lastInsertRowid,
      ),
      validBatch = Number(
        db
          .prepare(
            "INSERT INTO stock_batches(product_id,warehouse_id,batch_number,expiration_date,quantity) VALUES(?,?,?,'2099-01-01',5)",
          )
          .run(batchProduct, warehouse, "NEW").lastInsertRowid,
      );
    Pos.finalize(
      {
        client_request_id: `batch-${stamp}`,
        warehouse_id: warehouse,
        lines: [
          {
            line_type: "PRODUCT",
            product_id: batchProduct,
            product_unit_id: batchUnit,
            quantity: 3,
            unit_price: 10,
          },
        ],
        payments: [{ code: "CARD", amount: 30 }],
      },
      actor,
    );
    assert.equal(
      db
        .prepare("SELECT quantity FROM stock_batches WHERE id=?")
        .get(validBatch).quantity,
      2,
    );
    assert.equal(
      db
        .prepare("SELECT quantity FROM stock_batches WHERE id=?")
        .get(expiredBatch).quantity,
      5,
    );

    db.prepare(
      "UPDATE cash_sessions SET status='closed',closing_cash=1000,closed_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(session);
    assert.throws(
      () =>
        Pos.finalize(
          {
            client_request_id: `no-session-${stamp}`,
            warehouse_id: warehouse,
            lines: [{ ...productLine, quantity: 1 }],
            payments: [{ code: "CASH", amount: 100 }],
          },
          actor,
        ),
      /open cash session/,
    );
    const noSessionCard = Pos.finalize(
      {
        client_request_id: `no-session-card-${stamp}`,
        warehouse_id: warehouse,
        lines: [{ ...productLine, quantity: 1 }],
        payments: [{ code: "CARD", amount: 100 }],
      },
      actor,
    );
    assert.equal(noSessionCard.sale_status, "CONFIRMED");
    Settings.updateGroup(
      "sales",
      { max_discount_percent: 20, allow_discount: true },
      actor,
    );
    const today = new Date().toISOString().slice(0, 10),
      fixed = Pos.finalize(
        {
          client_request_id: `fixed-${stamp}`,
          warehouse_id: warehouse,
          sale_date: today,
          global_discount_type: "FIXED",
          global_discount_value: 20,
          lines: [
            {
              ...productLine,
              quantity: 2,
              discount_type: "FIXED",
              discount_value: 30,
            },
          ],
          payments: [{ code: "CARD", amount: 150 }],
        },
        actor,
      );
    assert.equal(fixed.sale_date, today);
    assert.equal(fixed.global_discount_type, "FIXED");
    assert.equal(fixed.global_discount_value, 20);
    assert.equal(fixed.global_discount_amount, 20);
    assert.equal(fixed.lines[0].discount_type, "FIXED");
    assert.equal(fixed.lines[0].discount_value, 30);
    assert.equal(fixed.lines[0].discount_amount, 30);
    assert.equal(fixed.total, 150);
    assert.throws(
      () =>
        Pos.finalize(
          {
            client_request_id: `backdate-${stamp}`,
            warehouse_id: warehouse,
            sale_date: "2020-01-01",
            lines: [{ ...productLine, quantity: 1 }],
            payments: [{ code: "CARD", amount: 100 }],
          },
          actor,
        ),
      /Backdating/,
    );
    for (let index = 0; index < 25; index++)
      db.prepare(
        "INSERT INTO customers(name,phone,is_active) VALUES(?,?,1)",
      ).run(`Search Client ${stamp} ${index}`, `0555${index}`);
    assert.equal(Pos.customerSearch("").length, 0);
    assert.equal(Pos.customerSearch(`Search Client ${stamp}`).length, 20);
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("POS integration test passed (transaction rolled back).");
