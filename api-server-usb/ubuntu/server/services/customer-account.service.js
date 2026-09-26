const db = require("../config/database");

const money = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function summary(customerId) {
  const row = db
    .prepare(
      `SELECT c.opening_balance + COALESCE(SUM(e.amount),0) account_balance
       FROM customers c
       LEFT JOIN customer_account_entries e ON e.customer_id=c.id
       WHERE c.id=?
       GROUP BY c.id`,
    )
    .get(Number(customerId));
  const accountBalance = money(row?.account_balance || 0);
  return {
    account_balance: accountBalance,
    receivable: Math.max(0, accountBalance),
    available_credit: Math.max(0, money(-accountBalance)),
  };
}

function addEntry({
  customerId,
  entryType,
  amount,
  saleId = null,
  paymentId = null,
  returnId = null,
  entryRole = null,
  reference = null,
  description = null,
  userId = null,
}) {
  const normalized = money(amount);
  if (!Number.isFinite(normalized) || normalized === 0)
    throw new Error("Customer account movement must be non-zero");
  const existing = returnId != null && entryRole
    ? db.prepare("SELECT id FROM customer_account_entries WHERE return_id=? AND entry_role=?").get(Number(returnId), entryRole)
    : saleId != null && ["SALE_CREDIT", "CREDIT_USAGE"].includes(entryType)
    ? db.prepare("SELECT id FROM customer_account_entries WHERE sale_id=? AND entry_type=?").get(Number(saleId), entryType)
    : paymentId != null && entryType === "CUSTOMER_PAYMENT"
      ? db.prepare("SELECT id FROM customer_account_entries WHERE payment_id=? AND entry_type='CUSTOMER_PAYMENT'").get(Number(paymentId))
      : null;
  if (existing) {
    db.prepare(`UPDATE customer_account_entries
      SET customer_id=?,amount=?,sale_id=?,payment_id=?,return_id=?,entry_role=?,reference=?,description=?,created_by=?
      WHERE id=?`).run(
      Number(customerId),
      normalized,
      saleId == null ? null : Number(saleId),
      paymentId == null ? null : Number(paymentId),
      returnId == null ? null : Number(returnId),
      entryRole,
      reference,
      description,
      userId,
      existing.id,
    );
    return Number(existing.id);
  }
  return Number(
    db
      .prepare(
        `INSERT INTO customer_account_entries(
          customer_id,entry_type,amount,sale_id,payment_id,return_id,entry_role,reference,description,created_by
        ) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        Number(customerId),
        entryType,
        normalized,
        saleId,
        paymentId,
        returnId,
        entryRole,
        reference,
        description,
        userId,
      ).lastInsertRowid,
  );
}

function entries(customerId) {
  return db
    .prepare(
      `SELECT e.*,s.sale_number,u.name created_by_name,
        c.opening_balance + SUM(e.amount) OVER (
          PARTITION BY e.customer_id ORDER BY e.created_at,e.id ROWS UNBOUNDED PRECEDING
        ) balance_after
       FROM customer_account_entries e
       JOIN customers c ON c.id=e.customer_id
       LEFT JOIN sales s ON s.id=e.sale_id
       LEFT JOIN users u ON u.id=e.created_by
       WHERE e.customer_id=?
       ORDER BY e.created_at DESC,e.id DESC`,
    )
    .all(Number(customerId));
}

module.exports = { money, summary, addEntry, entries };
