const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Purchases = require("../services/purchase.service");
const Analytics = require("../services/analytics.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouse = Number(db.prepare("INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)").run(`Purchase edit ${stamp}`).lastInsertRowid);
    const userId = Number(db.prepare("INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)").run(`purchaseedit${stamp}`, "x", "Purchase edit manager", warehouse).lastInsertRowid);
    const actor = { id: userId, role: "manager", warehouse_id: warehouse, warehouse_ids: [warehouse] };
    const supplier = Purchases.createSupplier({ name: `Edit supplier ${stamp}` }, actor);
    const unit = Number(db.prepare("INSERT INTO units(name,symbol) VALUES(?,?)").run(`Purchase edit unit ${stamp}`, "u").lastInsertRowid);
    const createProduct = (name, tracking) => {
      const product = Number(db.prepare(`INSERT INTO products(designation,unit_id,track_stock,${tracking}) VALUES(?,?,1,1)`).run(name, unit).lastInsertRowid);
      const productUnit = Number(db.prepare("INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base) VALUES(?,?,1,100,120,1)").run(product, unit).lastInsertRowid);
      db.prepare("INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,0)").run(product, warehouse);
      return { product, productUnit };
    };
    const stock = (product) => Number(db.prepare("SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?").get(product, warehouse).quantity);
    const supplierBalance = () => Number(db.prepare("SELECT COALESCE(SUM(amount),0) balance FROM supplier_account_entries WHERE supplier_id=?").get(supplier.id).balance);
    const report = () => Analytics.report({ start: "2000-01-01", end: "2999-12-31", warehouse_id: warehouse, category: "purchases" }, actor);

    const serial = createProduct(`Purchase serial ${stamp}`, "track_serials");
    const receipt = Purchases.createReceipt({ client_request_id: `serial-receipt-${stamp}`, warehouse_id: warehouse, supplier_id: supplier.id, lines: [{ product_id: serial.product, product_unit_id: serial.productUnit, quantity: 2, unit_price: 100, serial_numbers: [`PS-A-${stamp}`, `PS-B-${stamp}`] }] }, actor);
    assert.equal(receipt.status, "VALIDATED");
    assert.equal(stock(serial.product), 2);
    assert.equal(receipt.balance_due, 200);
    assert.equal(report().overview.purchases, 200);
    let edited = Purchases.updateReceipt(receipt.id, { client_request_id: `serial-increase-${stamp}`, supplier_id: supplier.id, lines: [{ ...receipt.lines[0], quantity: 3, unit_price: 100, serial_numbers: [`PS-A-${stamp}`, `PS-B-${stamp}`, `PS-C-${stamp}`] }] }, actor);
    assert.equal(edited.total, 300);
    assert.equal(edited.balance_due, 300);
    assert.equal(stock(serial.product), 3);
    assert.equal(supplierBalance(), 300);
    assert.equal(report().overview.purchases, 300);
    assert.equal(report().purchases.suppliers.find((row) => row.id === supplier.id).value, 300);
    const payment = { client_request_id: `receipt-payment-${stamp}`, payment_method_code: "CARD", amount: 300 };
    edited = Purchases.addReceiptPayment(receipt.id, payment, actor);
    assert.equal(edited.balance_due, 0);
    Purchases.addReceiptPayment(receipt.id, payment, actor);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM financial_transactions WHERE purchase_receipt_id=? AND source_type='PURCHASE_PAYMENT'").get(receipt.id).count, 1);
    assert.match(db.prepare("SELECT created_at FROM financial_transactions WHERE purchase_receipt_id=? AND source_type='PURCHASE_PAYMENT'").get(receipt.id).created_at, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);

    edited = Purchases.updateReceipt(receipt.id, { client_request_id: `serial-decrease-${stamp}`, supplier_id: supplier.id, lines: [{ ...edited.lines[0], quantity: 1, unit_price: 100, serial_numbers: [`PS-A-${stamp}`] }] }, actor);
    assert.equal(edited.total, 100);
    assert.equal(edited.paid_amount, 300);
    assert.equal(edited.balance_due, 0);
    assert.equal(edited.payment_summary.supplier_credit, 200);
    assert.equal(stock(serial.product), 1);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM stock_serials WHERE product_id=?").get(serial.product).count, 1);
    assert.equal(supplierBalance(), -200);
    assert.equal(report().overview.purchases, 100);

    const serialReturn = Purchases.createReturn(receipt.id, { client_request_id: `serial-return-${stamp}`, settlement_mode: "SUPPLIER_CREDIT", lines: [{ purchase_receipt_line_id: edited.lines[0].id, quantity: 1 }] }, actor);
    assert.equal(Purchases.createReturn(receipt.id, { client_request_id: `serial-return-${stamp}`, lines: [{ purchase_receipt_line_id: edited.lines[0].id, quantity: 1 }] }, actor).id, serialReturn.id);
    assert.equal(stock(serial.product), 0);
    assert.equal(db.prepare("SELECT status FROM stock_serials WHERE product_id=? AND serial_number=?").get(serial.product, `PS-A-${stamp}`).status, "RETURNED");
    assert.equal(Purchases.receiptDetail(receipt.id, actor).lines[0].returnable_quantity, 0);
    assert.equal(supplierBalance(), -300);
    assert.throws(() => Purchases.updateReceipt(receipt.id, { client_request_id: `remove-returned-${stamp}`, supplier_id: supplier.id, lines: [{ product_id: serial.product, product_unit_id: serial.productUnit, quantity: 1, unit_price: 100, serial_numbers: [`PS-Z-${stamp}`] }] }, actor), /returned receipt line cannot be removed/);

    const batch = createProduct(`Purchase batch ${stamp}`, "track_batches");
    const batchReceipt = Purchases.createReceipt({ client_request_id: `batch-receipt-${stamp}`, warehouse_id: warehouse, supplier_id: supplier.id, lines: [{ product_id: batch.product, product_unit_id: batch.productUnit, quantity: 2, unit_price: 100, batch_number: `PB-${stamp}` }] }, actor);
    const batchEdited = Purchases.updateReceipt(batchReceipt.id, { client_request_id: `batch-increase-${stamp}`, supplier_id: supplier.id, lines: [{ ...batchReceipt.lines[0], quantity: 4, unit_price: 100, batch_number: `PB-${stamp}` }] }, actor);
    assert.equal(batchEdited.total, 400);
    assert.equal(db.prepare("SELECT quantity FROM stock_batches WHERE product_id=? AND batch_number=?").get(batch.product, `PB-${stamp}`).quantity, 4);
    assert.equal(stock(batch.product), 4);
    assert.equal(supplierBalance(), 100);
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("Purchase edit integration test passed (stock, traceability, payments and supplier credit; rolled back).");
