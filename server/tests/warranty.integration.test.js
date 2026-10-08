"use strict";

const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Warranty = require("../services/warranty.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouseId = Number(db.prepare(
      "INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)",
    ).run(`Warranty warehouse ${stamp}`).lastInsertRowid);
    const userId = Number(db.prepare(
      "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'admin',?)",
    ).run(`warranty-${stamp}`, "x", "Warranty administrator", warehouseId).lastInsertRowid);
    const customerId = Number(db.prepare(
      "INSERT INTO customers(name,phone,email,address,is_active) VALUES(?,?,?,?,1)",
    ).run("Warranty customer", "0555000000", "customer@example.test", "Test address").lastInsertRowid);
    const unitId = Number(db.prepare(
      "INSERT INTO units(name,symbol) VALUES(?,?)",
    ).run(`Warranty unit ${stamp}`, `w${String(stamp).slice(-4)}`).lastInsertRowid);
    const productId = Number(db.prepare(
      "INSERT INTO products(designation,reference,unit_id,selling_price,track_stock,track_serials) VALUES(?,?,?,?,1,1)",
    ).run("Warranty laptop", `WAR-${stamp}`, unitId, 125000).lastInsertRowid);
    const productUnitId = Number(db.prepare(
      "INSERT INTO product_units(product_id,unit_id,conversion_factor,selling_price,is_base) VALUES(?,?,1,125000,1)",
    ).run(productId, unitId).lastInsertRowid);
    const serialId = Number(db.prepare(
      "INSERT INTO stock_serials(product_id,warehouse_id,serial_number,status) VALUES(?,?,?,'SOLD')",
    ).run(productId, warehouseId, `SER-${stamp}`).lastInsertRowid);
    const saleId = Number(db.prepare(
      `INSERT INTO sales(client_request_id,warehouse_id,customer_id,sale_number,fulfillment_type,
        sale_status,subtotal,total,payment_status,sale_date,created_by)
       VALUES(?,?,?,?,'IMMEDIATE','CONFIRMED',125000,125000,'PAID','2026-01-31',?)`,
    ).run(`warranty-sale-${stamp}`, warehouseId, customerId, `VNT-WAR-${stamp}`, userId).lastInsertRowid);
    const saleLineId = Number(db.prepare(
      `INSERT INTO sale_lines(sale_id,line_type,product_id,product_unit_id,designation,reference,
        unit_name,conversion_factor,quantity,base_quantity,unit_price,subtotal,total)
       VALUES(?,'PRODUCT',?,?,?,?,?,1,1,1,125000,125000,125000)`,
    ).run(saleId, productId, productUnitId, "Warranty laptop", `WAR-${stamp}`, "Unit").lastInsertRowid);
    db.prepare("INSERT INTO sale_serial_allocations(sale_line_id,serial_id) VALUES(?,?)").run(saleLineId, serialId);
    const actor = { id: userId, role: "admin", warehouse_id: warehouseId, warehouse_ids: [warehouseId] };

    const context = Warranty.context({ warehouse_id: warehouseId }, actor);
    assert.ok(context.customers.some((item) => item.id === customerId));
    assert.equal(context.products.find((item) => item.id === productId).serials[0].serial_number, `SER-${stamp}`);
    assert.equal(context.sales.find((item) => item.id === saleId).lines[0].serial_numbers[0], `SER-${stamp}`);

    const created = Warranty.create({
      warehouse_id: warehouseId,
      customer_id: customerId,
      customer_full_name: "Warranty customer",
      customer_phone: "0555000000",
      customer_email: "customer@example.test",
      customer_address: "Test address",
      product_id: productId,
      product_unit_id: productUnitId,
      product_nature: "Warranty laptop",
      product_model: `WAR-${stamp}`,
      product_brand: "MODERNA",
      serial_number: `SER-${stamp}`,
      invoiced_price: 125000,
      source_type: "SALE",
      source_reference: `VNT-WAR-${stamp}`,
      sale_date: "2026-01-31",
      duration_value: 1,
      duration_unit: "MONTHS",
      note: "Test warranty",
    }, actor);
    assert.match(created.warranty_number, /^GAR-/);
    assert.equal(created.warranty_end_date, "2026-02-28");
    assert.equal(created.serial_number, `SER-${stamp}`);
    assert.equal(created.source_type, "SALE");
    assert.equal(created.sale_id, saleId);
    assert.equal(created.invoice_id, null);
    assert.equal(created.print_profile.document_type, "WARRANTY");

    const listed = Warranty.list({ warehouse_id: warehouseId, search: `SER-${stamp}` }, actor);
    assert.equal(listed.items.length, 1);
    assert.equal(listed.items[0].id, created.id);

    const updated = Warranty.update(created.id, {
      ...created,
      duration_value: 30,
      duration_unit: "DAYS",
      invoiced_price: 120000,
      source_type: "INVOICE",
      source_reference: "MANUAL-INVOICE-1",
    }, actor);
    assert.equal(updated.warranty_end_date, "2026-03-02");
    assert.equal(updated.invoiced_price, 120000);
    assert.equal(updated.source_type, "INVOICE");
    assert.equal(updated.sale_id, null);
    assert.equal(updated.source_reference, "MANUAL-INVOICE-1");

    assert.throws(() => Warranty.create({ ...created, warehouse_id: warehouseId, customer_full_name: "" }, actor), /Required warranty information/);
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}

assert.equal(complete, true);
console.log("Warranty integration test passed (transaction rolled back).");
