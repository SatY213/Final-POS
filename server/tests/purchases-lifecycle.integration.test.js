const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Purchases = require("../services/purchase.service");
const Cash = require("../models/cash-session.model");
const Transactions = require("../services/transaction.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouseId = Number(db.prepare("INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)").run(`Purchase ${stamp}`).lastInsertRowid);
    const userId = Number(db.prepare("INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)").run(`purchase${stamp}`, "x", "Purchase manager", warehouseId).lastInsertRowid);
    const actor = { id: userId, role: "manager", warehouse_id: warehouseId, warehouse_ids: [warehouseId] };
    const supplier = Purchases.createSupplier({ name: `Supplier ${stamp}` }, actor);
    const unitId = Number(db.prepare("INSERT INTO units(name,symbol) VALUES(?,?)").run(`Purchase unit ${stamp}`, "u").lastInsertRowid);
    const productId = Number(db.prepare("INSERT INTO products(designation,unit_id,track_stock) VALUES(?,?,1)").run(`Purchase product ${stamp}`, unitId).lastInsertRowid);
    const productUnitId = Number(db.prepare("INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base) VALUES(?,?,1,10,20,1)").run(productId, unitId).lastInsertRowid);
    db.prepare("INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,0)").run(productId, warehouseId);
    const stock = () => Number(db.prepare("SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?").get(productId, warehouseId).quantity);
    const supplierBalance = () => Number(db.prepare("SELECT COALESCE(SUM(amount),0) balance FROM supplier_account_entries WHERE supplier_id=?").get(supplier.id).balance);

    const order = Purchases.createOrder({ client_request_id: `po-${stamp}`, warehouse_id: warehouseId, supplier_id: supplier.id, lines: [{ product_id: productId, product_unit_id: productUnitId, quantity: 10, unit_price: 10 }] }, actor);
    assert.equal(stock(), 0, "A purchase order never receives stock");
    const receive = (suffix, quantity) => Purchases.createReceipt({ client_request_id: `receipt-${suffix}-${stamp}`, purchase_order_id: order.id, warehouse_id: warehouseId, supplier_id: supplier.id, lines: [{ purchase_order_line_id: order.lines[0].id, quantity, unit_price: 10 }] }, actor);
    const first = receive("first", 4);
    assert.equal(first.status, "VALIDATED");
    assert.equal(first.total, 40);
    assert.equal(first.balance_due, 40);
    assert.equal(first.payment_status, "UNPAID");
    assert.equal(stock(), 4);
    assert.equal(supplierBalance(), 40);
    assert.equal(Purchases.orderDetail(order.id, actor).status, "PARTIALLY_RECEIVED");
    const second = receive("second", 6);
    assert.equal(stock(), 10);
    assert.equal(supplierBalance(), 100);
    assert.equal(Purchases.orderDetail(order.id, actor).status, "RECEIVED");
    assert.throws(() => receive("over", 1), /exceeds/);
    assert.equal(stock(), 10, "A rejected receipt must not add stock");

    const registerId = Number(db.prepare("INSERT INTO cash_registers(warehouse_id,name,code) VALUES(?,?,?)").run(warehouseId, "Purchase cash", `PUR-${stamp}`).lastInsertRowid);
    const session = Cash.open(registerId, userId, 100);
    const payment = { client_request_id: `pay-first-${stamp}`, amount: 40, payment_method_code: "CASH" };
    const paid = Purchases.addReceiptPayment(first.id, payment, actor);
    assert.equal(paid.balance_due, 0);
    assert.equal(paid.payment_status, "PAID");
    Purchases.addReceiptPayment(first.id, payment, actor);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM financial_transactions WHERE purchase_receipt_id=? AND source_type='PURCHASE_PAYMENT'").get(first.id).count, 1, "Retry must not duplicate the transaction");
    assert.equal(db.prepare("SELECT COUNT(*) count FROM cash_movements WHERE reference_type='PURCHASE_RECEIPT' AND reference_id=? AND direction='OUT'").get(String(first.id)).count, 1, "A cash purchase payment creates one cash OUT movement");
    assert.equal(Cash.listMovements(session.id)[0].reference_label, first.receipt_number);
    assert.throws(() => Purchases.addReceiptPayment(first.id, { client_request_id: `overpay-${stamp}`, amount: 1, payment_method_code: "CASH" }, actor), /remaining balance/);
    assert.equal(stock(), 10, "Paying a receipt must not move stock");
    const listed = Transactions.list({ warehouse_id: warehouseId }, actor).find((row) => row.purchase_receipt_id === first.id && row.source_type === "PURCHASE_PAYMENT");
    assert.equal(listed.direction, "OUT");
    assert.equal(listed.receipt_number, first.receipt_number);
    Purchases.addReceiptPayment(second.id, { client_request_id: `pay-second-${stamp}`, amount: 60, payment_method_code: "BANK_TRANSFER" }, actor);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM cash_movements WHERE reference_type='PURCHASE_RECEIPT' AND reference_id=?").get(String(second.id)).count, 0, "Bank transfer is not physical cash");

    const creditReturn = Purchases.createReturn(first.id, { client_request_id: `return-credit-${stamp}`, settlement_mode: "SUPPLIER_CREDIT", lines: [{ purchase_receipt_line_id: first.lines[0].id, quantity: 1 }] }, actor);
    assert.equal(creditReturn.total, 10);
    assert.equal(stock(), 9);
    assert.equal(supplierBalance(), -10);
    assert.equal(Purchases.receiptDetail(first.id, actor).payment_summary.supplier_credit, 10);
    assert.equal(Purchases.createReturn(first.id, { client_request_id: `return-credit-${stamp}`, lines: [{ purchase_receipt_line_id: first.lines[0].id, quantity: 1 }] }, actor).id, creditReturn.id);
    assert.throws(() => Purchases.createReturn(first.id, { client_request_id: `return-over-${stamp}`, lines: [{ purchase_receipt_line_id: first.lines[0].id, quantity: 4 }] }, actor), /exceeds/);
    const refundReturn = Purchases.createReturn(second.id, { client_request_id: `return-refund-${stamp}`, settlement_mode: "REFUND", refund_payment_method_code: "CASH", lines: [{ purchase_receipt_line_id: second.lines[0].id, quantity: 1 }] }, actor);
    assert.equal(refundReturn.refund_amount, 10);
    assert.equal(stock(), 8);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM cash_movements WHERE reference_type='SUPPLIER_RETURN' AND reference_id=? AND direction='IN'").get(String(refundReturn.id)).count, 1);
    assert.equal(Cash.listMovements(session.id)[0].reference_label, refundReturn.return_number);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM financial_transactions WHERE supplier_return_id=? AND source_type='SUPPLIER_RETURN_REFUND'").get(refundReturn.id).count, 1);
    assert.equal(supplierBalance(), -10, "Historical payments remain while unrefunded excess is supplier credit");
    assert.equal(db.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name IN ('supplier_invoices','supplier_payments')").get().count, 0);
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("Purchase lifecycle integration test passed (transaction rolled back).");
