const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Exchange = require("../services/data-exchange.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouseName = `Entrepôt import ${stamp}`;
    const warehouseId = Number(
      db.prepare("INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)")
        .run(warehouseName).lastInsertRowid,
    );
    const userId = Number(
      db.prepare("INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)")
        .run(`import${stamp}`, "x", "Import manager", warehouseId).lastInsertRowid,
    );
    const actor = { id: userId, role: "manager", warehouse_id: warehouseId, warehouse_ids: [warehouseId] };
    const unit = db.prepare("SELECT name FROM units WHERE is_active=1 ORDER BY is_builtin DESC,id LIMIT 1").get();
    const reference = `IMP-${stamp}`;
    const productCsv = [
      "designation;reference;unit;purchase_price;selling_price;min_stock;track_stock;track_serials;track_batches;track_expiration;active",
      `Produit import fictif;${reference};${unit.name};100;150;2;oui;oui;non;non;oui`,
    ].join("\r\n");
    const preview = Exchange.preview("products", productCsv, actor);
    assert.equal(preview.total, 1);
    assert.equal(preview.valid_count, 1);
    assert.deepEqual(Exchange.commit("products", productCsv, "error", actor), {
      entity: "products", total: 1, created: 1, updated: 0, skipped: 0,
    });
    assert.equal(Exchange.commit("products", productCsv, "skip", actor).skipped, 1);

    const badStockCsv = [
      "product_reference;warehouse;quantity;serial_numbers",
      `${reference};${warehouseName};2;UN-SEUL-SERIAL`,
    ].join("\r\n");
    assert.equal(Exchange.preview("initial_stock", badStockCsv, actor).error_count, 1);

    const stockCsv = [
      "product_reference;warehouse;quantity;serial_numbers",
      `${reference};${warehouseName};2;${reference}-S1|${reference}-S2`,
    ].join("\r\n");
    assert.equal(Exchange.preview("initial_stock", stockCsv, actor).valid_count, 1);
    assert.equal(Exchange.commit("initial_stock", stockCsv, "error", actor).created, 1);
    const product = db.prepare("SELECT id FROM products WHERE reference=?").get(reference);
    assert.equal(db.prepare("SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?").get(product.id, warehouseId).quantity, 2);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM stock_serials WHERE product_id=? AND warehouse_id=?").get(product.id, warehouseId).count, 2);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM stock_movements WHERE product_id=? AND warehouse_id=? AND type='RECEIPT'").get(product.id, warehouseId).count, 1);

    const exported = Exchange.exportCsv("products", { warehouse_id: warehouseId, search: reference, status: "active" }, actor);
    assert.match(exported, new RegExp(reference));
    assert.match(exported, /stock_quantity/);
    assert.doesNotMatch(exported, /Produit hors filtre impossible/);

    const sqlCustomerName = `Client SQL ${stamp}`;
    const customerSql = Exchange.template("customers", actor, "sql")
      .replace("Client Démo SARL", sqlCustomerName)
      .replace("0550000000", String(stamp).slice(-10));
    const sqlPreview = Exchange.preview("customers", customerSql, actor, "sql");
    assert.equal(sqlPreview.valid_count, 1);
    assert.equal(Exchange.commit("customers", customerSql, "error", actor, "sql").created, 1);
    const exportedSql = Exchange.exportSql("customers", { search: sqlCustomerName, status: "active" }, actor);
    assert.match(exportedSql, /INSERT INTO "customers"/);
    assert.match(exportedSql, new RegExp(sqlCustomerName));
    assert.equal(Exchange.preview("customers", exportedSql, actor, "sql").valid_count, 1);
    assert.throws(
      () => Exchange.preview("customers", `${customerSql}\nDROP TABLE customers;`, actor, "sql"),
      /Only INSERT statements/,
    );

    for (const entity of [
      "sales",
      "stock",
      "quotes",
      "purchase_orders",
      "purchase_receipts",
      "customer_invoices",
      "transactions",
      "customer_payments",
      "cash_movements",
      "stock_movements",
    ]) {
      assert.equal(
        typeof Exchange.exportCsv(
          entity,
          {
            warehouse_id: warehouseId,
            search: reference,
            from: "2000-01-01",
            to: "2999-12-31",
          },
          actor,
        ),
        "string",
        `${entity} export must execute with the shared filters`,
      );
    }
    const forbiddenWarehouse = db
      .prepare("SELECT id FROM warehouses WHERE id<>? ORDER BY id LIMIT 1")
      .get(warehouseId);
    if (forbiddenWarehouse)
      assert.throws(
        () =>
          Exchange.exportCsv(
            "transactions",
            { warehouse_id: forbiddenWarehouse.id },
            actor,
          ),
        /unauthorized/,
      );

    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("Data exchange integration test passed (preview, transactional import, stock domain operation and filtered export).");
