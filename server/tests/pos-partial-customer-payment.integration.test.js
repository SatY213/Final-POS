const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Pos = require("../services/pos.service");
const Account = require("../services/customer-account.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouseId = Number(db.prepare("INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)").run(`Partial ${stamp}`).lastInsertRowid);
    const userId = Number(db.prepare("INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)").run(`partial${stamp}`, "x", "Partial manager", warehouseId).lastInsertRowid);
    const customerId = Number(db.prepare("INSERT INTO customers(name,is_active) VALUES(?,1)").run(`Partial customer ${stamp}`).lastInsertRowid);
    db.prepare("INSERT INTO warehouse_document_sequences(warehouse_id,document_type,current_value) VALUES(?,?,?)").run(warehouseId, "SALE", stamp);
    const sale = Pos.finalize({
      client_request_id: `partial-${stamp}`,
      warehouse_id: warehouseId,
      customer_id: customerId,
      leave_unpaid: true,
      lines: [{ line_type: "SERVICE", designation: "Service", unit_name: "Unité", quantity: 1, unit_price: 100 }],
      payments: [{ code: "CARD", amount: 40 }],
    }, { id: userId, role: "manager", warehouse_id: warehouseId });
    assert.equal(sale.payment_status, "PARTIALLY_PAID");
    const entry = db.prepare("SELECT * FROM customer_account_entries WHERE sale_id=? AND entry_type='SALE_CREDIT'").get(sale.id);
    assert.equal(entry.amount, 60);
    assert.equal(Account.summary(customerId).receivable, 60);
    assert.equal(Account.addEntry({ customerId, entryType: "SALE_CREDIT", amount: 60, saleId: sale.id, userId }), entry.id);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM customer_account_entries WHERE sale_id=? AND entry_type='SALE_CREDIT'").get(sale.id).count, 1);
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("POS partial customer payment integration test passed (transaction rolled back).");
