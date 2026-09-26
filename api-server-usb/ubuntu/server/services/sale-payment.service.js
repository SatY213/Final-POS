const db = require("../config/database");
const Account = require("./customer-account.service");

function paymentSummary(saleId, totalValue) {
  const grossTotal = Account.money(totalValue);
  // Physical returns reduce what is still due on the sale.  The original sale
  // total remains immutable so that an issued invoice can retain its history.
  const returnedTotal = Account.money(
    db.prepare(`SELECT COALESCE(SUM(return_total),0) amount
      FROM sales_returns WHERE sale_id=? AND status='VALIDATED'`).get(Number(saleId)).amount,
  );
  const total = Math.max(0, Account.money(grossTotal - returnedTotal));
  const paidTotal = Account.money(
    db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) amount FROM sale_payments WHERE sale_id=?",
      )
      .get(Number(saleId)).amount,
  );
  const creditUsed = Account.money(
    db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) amount FROM customer_account_entries WHERE sale_id=? AND entry_type='CREDIT_USAGE'",
      )
      .get(Number(saleId)).amount,
  );
  const settledTotal = Account.money(paidTotal + creditUsed);
  const balanceDue = Math.max(0, Account.money(total - settledTotal));
  return {
    gross_total: grossTotal,
    returned_total: returnedTotal,
    net_total: total,
    paid_total: paidTotal,
    paid_amount: paidTotal,
    credit_used: creditUsed,
    settled_total: settledTotal,
    balance_due: balanceDue,
    credit_amount: Math.max(0, Account.money(settledTotal - total)),
    payment_status:
      balanceDue <= 0
        ? "PAID"
        : paidTotal > 0 || creditUsed > 0
          ? "PARTIALLY_PAID"
          : "UNPAID",
  };
}

function syncPaymentStatus(saleId) {
  const sale = db.prepare("SELECT total FROM sales WHERE id=?").get(saleId);
  if (!sale) throw new Error("Sale not found");
  const result = paymentSummary(saleId, sale.total);
  db.prepare("UPDATE sales SET payment_status=? WHERE id=?").run(
    result.payment_status,
    saleId,
  );
  return result;
}

module.exports = { paymentSummary, syncPaymentStatus };
