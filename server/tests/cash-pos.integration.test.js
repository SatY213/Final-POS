const assert = require("node:assert/strict"),
  db = require("../config/database");
require("../database/migrations/init");
const Pos = require("../services/pos.service"),
  Cash = require("../models/cash-session.model"),
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
          .run(`Cash POS ${stamp}`).lastInsertRowid,
      ),
      userId = Number(
        db
          .prepare(
            "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'cashier',?)",
          )
          .run(`cashpos${stamp}`, "x", "Cash POS", warehouse).lastInsertRowid,
      ),
      user = { id: userId, role: "cashier", warehouse_id: warehouse },
      register = Number(
        db
          .prepare(
            "INSERT INTO cash_registers(warehouse_id,name,code) VALUES(?,?,?)",
          )
          .run(warehouse, "Cash POS", `CP-${stamp}`).lastInsertRowid,
      ),
      session = Cash.open(register, userId, 1200);
    Settings.updateGroup("payments", { default_method: "CASH" }, user);
    const line = (amount) => [
      {
        line_type: "MISC",
        designation: "Test",
        unit_name: "Unit",
        quantity: 1,
        unit_price: amount,
      },
    ];
    const sale = (id, amount, payments) =>
      Pos.finalize(
        {
          client_request_id: `${id}-${stamp}`,
          warehouse_id: warehouse,
          lines: line(amount),
          payments,
        },
        user,
      );
    const cashSale = sale("cash", 3000, [{ code: "CASH", amount: 3000 }]);
    let summary = Cash.findById(session.id);
    assert.equal(summary.expected_cash, 4200);
    assert.equal(summary.cash_sales_total, 3000);
    assert.equal(summary.manual_in_total, 0);
    assert.equal(
      Cash.listMovements(session.id)[0].reference_label,
      cashSale.sale_number,
    );
    sale("card", 5000, [{ code: "CARD", amount: 5000 }]);
    summary = Cash.findById(session.id);
    assert.equal(summary.expected_cash, 4200);
    assert.equal(summary.cash_sales_total, 3000);
    Cash.createMovement(session.id, userId, "IN", 500, "Change contribution");
    summary = Cash.findById(session.id);
    assert.equal(summary.expected_cash, 4700);
    assert.equal(summary.manual_in_total, 500);
    Cash.createMovement(session.id, userId, "OUT", 700, "Safe deposit");
    summary = Cash.findById(session.id);
    assert.equal(summary.expected_cash, 4000);
    assert.equal(summary.manual_out_total, 700);
    assert.throws(
      () =>
        sale("split", 10000, [
          { code: "CASH", amount: 4000, amount_received: 4000 },
          { code: "CARD", amount: 6000 },
        ]),
      /one payment method/i,
    );
    summary = Cash.findById(session.id);
    assert.equal(summary.expected_cash, 4000);
    assert.equal(summary.cash_sales_total, 3000);
    const received = sale("received", 4000, [
      { code: "CASH", amount: 4000, amount_received: 5000 },
    ]);
    summary = Cash.findById(session.id);
    assert.equal(received.payments[0].change_amount, 1000);
    assert.equal(summary.expected_cash, 8000);
    assert.equal(summary.cash_sales_total, 7000);
    assert.equal(
      db
        .prepare(
          "SELECT amount FROM cash_movements WHERE reference_type='SALE' AND reference_id=?",
        )
        .get(received.id).amount,
      4000,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) count FROM cash_movements WHERE cash_session_id=? AND movement_type='SALE_PAYMENT'",
        )
        .get(session.id).count,
      2,
    );
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("Cash/POS integration test passed (transaction rolled back).");
