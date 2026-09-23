const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Pos = require("../services/pos.service");
const Commercial = require("../services/commercial.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouseId = Number(
      db.prepare("INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)").run(`Serial POS ${stamp}`).lastInsertRowid,
    );
    const userId = Number(
      db.prepare("INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)").run(`serial${stamp}`, "x", "Serial manager", warehouseId).lastInsertRowid,
    );
    const actor = { id: userId, role: "manager", warehouse_id: warehouseId };
    const unitId = Number(
      db.prepare("INSERT INTO units(name,symbol) VALUES(?,?)").run(`Serial unit ${stamp}`, "pc").lastInsertRowid,
    );
    const productId = Number(
      db.prepare("INSERT INTO products(designation,unit_id,track_stock,track_serials) VALUES(?,?,1,1)").run("Serialized laptop", unitId).lastInsertRowid,
    );
    const productUnitId = Number(
      db.prepare("INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base) VALUES(?,?,1,0,100,1)").run(productId, unitId).lastInsertRowid,
    );
    db.prepare("INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,2)").run(productId, warehouseId);
    const firstSerialId = Number(
      db.prepare("INSERT INTO stock_serials(product_id,warehouse_id,serial_number,status) VALUES(?,?,?,'AVAILABLE')").run(productId, warehouseId, `SN-A-${stamp}`).lastInsertRowid,
    );

    assert.equal(Pos.availableSerials(productId, warehouseId, actor).length, 1);
    const added = Pos.addAvailableSerial(productId, warehouseId, `SN-B-${stamp}`, actor);
    assert.equal(Pos.availableSerials(productId, warehouseId, actor).length, 2);
    assert.throws(() => Pos.addAvailableSerial(productId, warehouseId, `SN-C-${stamp}`, actor), /already have a serial number/);

    db.prepare("INSERT INTO warehouse_document_sequences(warehouse_id,document_type,current_value) VALUES(?,?,?)").run(warehouseId, "SALE", stamp);
    const saleInput = {
      client_request_id: `serial-sale-${stamp}`,
      warehouse_id: warehouseId,
      lines: [{
        product_id: productId,
        product_unit_id: productUnitId,
        quantity: 1,
        unit_price: 100,
      }],
      payments: [{ code: "CARD", amount: 100 }],
    };
    assert.throws(() => Pos.finalize(saleInput, actor), /Select one serial number/);
    const sale = Pos.finalize({
      ...saleInput,
      client_request_id: `serial-sale-selected-${stamp}`,
      lines: [{ ...saleInput.lines[0], serial_ids: [added.id] }],
    }, actor);
    assert.equal(
      db.prepare("SELECT status FROM stock_serials WHERE id=?").get(added.id).status,
      "SOLD",
    );
    assert.equal(
      db.prepare("SELECT serial_id FROM sale_serial_allocations WHERE sale_line_id=?").get(sale.lines[0].id).serial_id,
      added.id,
    );
    assert.equal(
      db.prepare("SELECT status FROM stock_serials WHERE id=?").get(firstSerialId).status,
      "AVAILABLE",
    );
    db.prepare("UPDATE document_sequences SET current_value=? WHERE document_type='SALES_RETURN'").run(stamp);
    const returned = Commercial.createReturn(sale.id, {
      client_request_id: `serial-return-${stamp}`,
      settlement_mode: "CUSTOMER_CREDIT",
      lines: [{ sale_line_id: sale.lines[0].id, quantity: 1 }],
    }, actor);
    assert.equal(db.prepare("SELECT status FROM stock_serials WHERE id=?").get(added.id).status, "AVAILABLE");
    assert.equal(db.prepare("SELECT serial_id FROM sales_return_serial_allocations WHERE sales_return_line_id=?").get(returned.lines[0].id).serial_id, added.id);
    assert.equal(db.prepare("SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?").get(productId, warehouseId).quantity, 2);
    assert.throws(
      () => Commercial.createReturn(sale.id, {
        client_request_id: `serial-return-again-${stamp}`,
        lines: [{ sale_line_id: sale.lines[0].id, quantity: 1 }],
      }, actor),
      /physically fulfilled quantity|not returnable/,
    );

    const batchProductId = Number(
      db.prepare("INSERT INTO products(designation,unit_id,track_stock,track_batches,track_expiration) VALUES(?,?,1,1,1)").run("Batch product", unitId).lastInsertRowid,
    );
    const batchUnitId = Number(
      db.prepare("INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base) VALUES(?,?,1,0,50,1)").run(batchProductId, unitId).lastInsertRowid,
    );
    db.prepare("INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,5)").run(batchProductId, warehouseId);
    const batchId = Number(
      db.prepare("INSERT INTO stock_batches(product_id,warehouse_id,batch_number,expiration_date,quantity) VALUES(?,?,?,?,?)").run(batchProductId, warehouseId, `LOT-${stamp}`, "2030-12-31", 5).lastInsertRowid,
    );
    const batchSale = Pos.finalize({
      client_request_id: `batch-sale-${stamp}`,
      warehouse_id: warehouseId,
      lines: [{ product_id: batchProductId, product_unit_id: batchUnitId, quantity: 2, unit_price: 50, batch_id: batchId }],
      payments: [{ code: "CARD", amount: 100 }],
    }, actor);
    assert.equal(db.prepare("SELECT quantity FROM stock_batches WHERE id=?").get(batchId).quantity, 3);
    const batchReturn = Commercial.createReturn(batchSale.id, {
      client_request_id: `batch-return-${stamp}`,
      settlement_mode: "CUSTOMER_CREDIT",
      lines: [{ sale_line_id: batchSale.lines[0].id, quantity: 1 }],
    }, actor);
    assert.equal(db.prepare("SELECT quantity FROM stock_batches WHERE id=?").get(batchId).quantity, 4);
    assert.equal(db.prepare("SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?").get(batchProductId, warehouseId).quantity, 4);
    assert.equal(db.prepare("SELECT batch_id FROM sales_return_batch_allocations WHERE sales_return_line_id=?").get(batchReturn.lines[0].id).batch_id, batchId);
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("POS serial selection integration test passed (transaction rolled back).");
