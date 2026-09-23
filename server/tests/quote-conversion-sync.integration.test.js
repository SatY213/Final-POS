const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Commercial = require("../services/commercial.service");
const Pos = require("../services/pos.service");
const Settings = require("../services/settings.service");

let completed = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouseId = Number(
      db.prepare("INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)")
        .run(`Quote conversion ${stamp}`).lastInsertRowid,
    );
    const userId = Number(
      db.prepare(
        "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)",
      ).run(`quote-conversion-${stamp}`, "x", "Quote conversion", warehouseId)
        .lastInsertRowid,
    );
    const actor = {
      id: userId,
      role: "manager",
      warehouse_id: warehouseId,
      warehouse_ids: [warehouseId],
    };
    const customerId = Number(
      db.prepare("INSERT INTO customers(name,is_active) VALUES(?,1)")
        .run(`Quote customer ${stamp}`).lastInsertRowid,
    );
    const unitId = Number(
      db.prepare("INSERT INTO units(name,symbol) VALUES(?,?)")
        .run(`Quote unit ${stamp}`, "u").lastInsertRowid,
    );
    const createProduct = (name, price) => {
      const productId = Number(
        db.prepare(
          "INSERT INTO products(designation,unit_id,track_stock) VALUES(?,?,1)",
        ).run(name, unitId).lastInsertRowid,
      );
      const productUnitId = Number(
        db.prepare(
          "INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base) VALUES(?,?,1,?,?,1)",
        ).run(productId, unitId, price / 2, price).lastInsertRowid,
      );
      db.prepare(
        "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,20)",
      ).run(productId, warehouseId);
      return { productId, productUnitId, price };
    };
    const first = createProduct(`Quoted product ${stamp}`, 100);
    const added = createProduct(`Added product ${stamp}`, 50);
    Settings.updateGroup(
      "sales",
      { allow_price_edit: false },
      actor,
    );
    const quote = Commercial.saveQuote(
      {
        client_request_id: `quote-${stamp}`,
        warehouse_id: warehouseId,
        customer_id: customerId,
        lines: [
          {
            product_id: first.productId,
            product_unit_id: first.productUnitId,
            quantity: 1,
            unit_price: first.price,
          },
        ],
      },
      actor,
    );
    db.prepare("UPDATE product_units SET selling_price=120 WHERE id=?")
      .run(first.productUnitId);
    const sale = Pos.finalize(
      {
        client_request_id: `sale-${stamp}`,
        source_quote_id: quote.id,
        warehouse_id: warehouseId,
        customer_id: customerId,
        lines: [
          { ...quote.lines[0], quantity: 2 },
          {
            product_id: added.productId,
            product_unit_id: added.productUnitId,
            quantity: 1,
            unit_price: added.price,
          },
        ],
        payments: [{ code: "CARD", amount: 250 }],
      },
      actor,
    );
    assert.equal(sale.total, 250);
    assert.equal(sale.lines.length, 2);
    const converted = Commercial.quoteDetail(quote.id, actor);
    assert.equal(converted.status, "CONVERTED");
    assert.equal(converted.converted_sale_id, sale.id);
    assert.equal(converted.total, 250);
    assert.equal(converted.lines.length, 2);
    assert.equal(converted.lines[0].quantity, 2);
    assert.equal(converted.lines[1].product_id, added.productId);
    completed = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}

assert.equal(completed, true);
console.log("Quote conversion synchronization integration test passed (transaction rolled back).");
