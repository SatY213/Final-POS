const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Pos = require("../services/pos.service");
const Commercial = require("../services/commercial.service");
const Invoice = require("../services/invoice.service");
const SalePayment = require("../services/sale-payment.service");
const Account = require("../services/customer-account.service");
const Cash = require("../models/cash-session.model");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouseId = Number(db.prepare("INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)").run(`Return finance ${stamp}`).lastInsertRowid);
    const userId = Number(db.prepare("INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)").run(`returnfinance${stamp}`, "x", "Return manager", warehouseId).lastInsertRowid);
    const customerId = Number(db.prepare("INSERT INTO customers(name,is_active) VALUES(?,1)").run(`Return customer ${stamp}`).lastInsertRowid);
    const user = { id: userId, role: "manager", warehouse_id: warehouseId };
    const registerId = Number(db.prepare("INSERT INTO cash_registers(warehouse_id,name,code) VALUES(?,?,?)").run(warehouseId, "Return cash", `RETURN-${stamp}`).lastInsertRowid);
    const session = Cash.open(registerId, userId, 0);
    const sale = Pos.finalize({
      client_request_id: `return-invoice-sale-${stamp}`, warehouse_id: warehouseId, customer_id: customerId, leave_unpaid: true,
      lines: [{ line_type: "MISC", designation: "Article", unit_name: "U", quantity: 10, unit_price: 10 }],
      payments: [{ code: "CARD", amount: 40 }],
    }, user);
    const invoice = Invoice.createForSales([sale.id], { client_request_id: `return-invoice-${stamp}`, tax_enabled: false, stamp_enabled: false }, user);
    const returned = Commercial.createReturn(sale.id, {
      client_request_id: `return-credit-${stamp}`,
      lines: [{ sale_line_id: sale.lines[0].id, quantity: 3 }],
    }, user);
    assert.equal(db.prepare("SELECT total FROM invoices WHERE id=?").get(invoice.id).total, 100);
    assert.equal(db.prepare("SELECT total FROM invoice_credit_notes WHERE sales_return_id=?").get(returned.id).total, 30);
    assert.equal(Invoice.detail(invoice.id, user).balance_due, 30);
    assert.equal(SalePayment.paymentSummary(sale.id, sale.total).balance_due, 30);
    assert.equal(Account.summary(customerId).receivable, 30);
    Commercial.addPayment(sale.id, { payment_method_code: "CASH", amount: 30 }, user);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM cash_movements WHERE reference_type='SALE' AND reference_id=? AND direction='IN'").get(sale.id).count, 1);

    const paidSale = Pos.finalize({
      client_request_id: `refund-sale-${stamp}`, warehouse_id: warehouseId, customer_id: customerId,
      lines: [{ line_type: "MISC", designation: "Refundable", unit_name: "U", quantity: 5, unit_price: 10 }],
      payments: [{ code: "CARD", amount: 50 }],
    }, user);
    const refund = Commercial.createReturn(paidSale.id, {
      client_request_id: `refund-${stamp}`, settlement_mode: "REFUND", refund_payment_method_code: "CASH",
      lines: [{ sale_line_id: paidSale.lines[0].id, quantity: 2 }],
    }, user);
    assert.equal(refund.refund_amount, 20);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM cash_movements WHERE reference_type='SALES_RETURN' AND reference_id=? AND direction='OUT'").get(refund.id).count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM financial_transactions WHERE source_type='CUSTOMER_RETURN_REFUND' AND reference=?").get(`RETURN:${refund.id}`).count, 1);
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("Return/invoice/financial integration test passed (transaction rolled back).");
