const db = require("../config/database");
function list(query = {}, user) {
  const where = ["1=1"], params = {};
  if (query.customer_id) { where.push("t.customer_id=@customer"); params.customer = Number(query.customer_id); }
  if (query.method) { where.push("t.payment_method_code=@method"); params.method = query.method; }
  if (["IN", "OUT"].includes(query.direction)) { where.push("t.direction=@direction"); params.direction = query.direction; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.from || ""))) { where.push("date(t.created_at)>=date(@from)"); params.from = query.from; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.to || ""))) { where.push("date(t.created_at)<=date(@to)"); params.to = query.to; }
  if (query.search) { where.push("fuzzy_match(@search,s.sale_number,rs.sale_number,i.invoice_number,pr.receipt_number,sr.return_number,csr.return_number,sup.name,c.name,pm.name,t.payment_method_code,t.source_type)=1"); params.search = String(query.search).trim(); }
  const selectedWarehouse = Number(query.warehouse_id);
  if (selectedWarehouse) {
    if (user.role !== "admin" && user.warehouse_id && Number(user.warehouse_id) !== selectedWarehouse)
      throw Object.assign(new Error("Warehouse is unauthorized"), { status: 403 });
    where.push("COALESCE(s.warehouse_id,i.warehouse_id,pr.warehouse_id,sr.warehouse_id,cr.warehouse_id)=@warehouse");
    params.warehouse = selectedWarehouse;
  } else if (user.role !== "admin" && user.warehouse_id) {
    where.push("COALESCE(s.warehouse_id,i.warehouse_id,pr.warehouse_id,sr.warehouse_id,cr.warehouse_id)=@warehouse");
    params.warehouse = Number(user.warehouse_id);
  }
  return db.prepare(`SELECT t.*,c.name customer_name,sup.name supplier_name,pm.name payment_method_name,
    COALESCE(s.id,rs.id) sale_id,COALESCE(s.sale_number,rs.sale_number) sale_number,
    COALESCE(s.fulfillment_type,rs.fulfillment_type) sale_fulfillment_mode,
    i.id invoice_id,i.invoice_number,
    pr.id purchase_receipt_id,pr.receipt_number,sr.id supplier_return_id,sr.return_number supplier_return_number,
    csr.id customer_return_id,csr.return_number customer_return_number
    FROM financial_transactions t LEFT JOIN customers c ON c.id=t.customer_id LEFT JOIN payment_methods pm ON pm.code=t.payment_method_code
    LEFT JOIN sale_payments sp ON sp.id=t.sale_payment_id LEFT JOIN sales s ON s.id=sp.sale_id
    LEFT JOIN invoice_payments ip ON ip.id=t.invoice_payment_id LEFT JOIN invoices i ON i.id=ip.invoice_id
    LEFT JOIN sales_returns csr ON csr.id=t.sales_return_id LEFT JOIN sales rs ON rs.id=csr.sale_id
    LEFT JOIN suppliers sup ON sup.id=t.supplier_id
    LEFT JOIN supplier_returns sr ON sr.id=t.supplier_return_id
    LEFT JOIN purchase_receipts pr ON pr.id=COALESCE(t.purchase_receipt_id,sr.purchase_receipt_id)
    LEFT JOIN cash_sessions cs ON cs.id=t.cash_session_id LEFT JOIN cash_registers cr ON cr.id=cs.cash_register_id
    WHERE ${where.join(" AND ")} ORDER BY t.created_at DESC,t.id DESC LIMIT 200`).all(params);
}
module.exports = { list };
