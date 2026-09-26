const db = require("../config/database"),
  Settings = require("./settings.service");
const SalePayment = require("./sale-payment.service");
class SalesError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
function authorizeWarehouse(value, user) {
  const id = Number(value),
    row = db
      .prepare("SELECT id,name FROM warehouses WHERE id=? AND is_active=1")
      .get(id);
  if (!row) throw new SalesError("Warehouse not found", 404);
  if (
    user.role !== "admin" &&
    (user.warehouse_ids?.length
      ? !user.warehouse_ids.map(Number).includes(id)
      : user.warehouse_id != null && Number(user.warehouse_id) !== id)
  )
    throw new SalesError("You cannot access sales from this warehouse", 403);
  return row;
}
function buildFilters(query, user) {
  const warehouse = authorizeWarehouse(query.warehouse_id, user),
    where = ["s.sale_status<>'DRAFT'", "s.warehouse_id=@warehouse"],
    params = { warehouse: warehouse.id };
  if (query.search) {
    where.push(
      "fuzzy_match(@search,s.sale_number,c.name,s.customer_reference)=1",
    );
    params.search = String(query.search).trim();
  }
  if (query.from) {
    where.push("s.sale_date>=@from");
    params.from = String(query.from);
  }
  if (query.to) {
    where.push("s.sale_date<=@to");
    params.to = String(query.to);
  }
  for (const [key, column] of [
    ["customer_id", "s.customer_id"],
    ["seller_id", "s.created_by"],
    ["payment_status", "s.payment_status"],
    ["return_status", "s.return_status"],
    ["fulfillment_type", "s.fulfillment_type"],
  ])
    if (query[key]) {
      where.push(`${column}=@${key}`);
      params[key] = query[key];
    }
  if (query.delivery_status) {
    where.push(
      "EXISTS(SELECT 1 FROM deliveries d WHERE d.sale_id=s.id AND d.status=@delivery_status)",
    );
    params.delivery_status = query.delivery_status;
  }
  if (query.payment_method_code) {
    where.push(
      "EXISTS(SELECT 1 FROM sale_payments p WHERE p.sale_id=s.id AND p.payment_method_code=@payment)",
    );
    params.payment = query.payment_method_code;
  }
  return { warehouse, where: where.join(" AND "), params };
}
function list(query, user) {
  const { where, params } = buildFilters(query, user),
    page = Math.max(1, parseInt(query.page, 10) || 1),
    limit = Math.min(100, Math.max(10, parseInt(query.limit, 10) || 25)),
    summary = db
      .prepare(
        `SELECT COUNT(*) count,COALESCE(SUM(s.total),0) gross_amount,COALESCE(SUM((SELECT COALESCE(SUM(r.return_total),0) FROM sales_returns r WHERE r.sale_id=s.id AND r.status='VALIDATED')),0) return_amount FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE ${where}`,
      )
      .get(params),
    items = db
      .prepare(
        `SELECT s.id,s.sale_number,s.sale_number document_number,s.document_type,s.sale_date,s.created_at,s.completed_at,s.customer_reference,s.total,s.payment_status,s.return_status,s.sale_status,s.fulfillment_type,CASE WHEN s.fulfillment_type='IMMEDIATE' THEN NULL ELSE (SELECT d.status FROM deliveries d WHERE d.sale_id=s.id ORDER BY d.id DESC LIMIT 1) END delivery_status,COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id=s.id),0) paid_amount,COALESCE((SELECT SUM(e.amount) FROM customer_account_entries e WHERE e.sale_id=s.id AND e.entry_type='CREDIT_USAGE'),0) credit_used,MAX(0,s.total-COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id=s.id),0)-COALESCE((SELECT SUM(e.amount) FROM customer_account_entries e WHERE e.sale_id=s.id AND e.entry_type='CREDIT_USAGE'),0)) balance_due,c.name customer_name,u.name seller_name,(SELECT GROUP_CONCAT(pm.name,' + ') FROM sale_payments p JOIN payment_methods pm ON pm.code=p.payment_method_code WHERE p.sale_id=s.id) payment_methods,(SELECT i.id FROM invoice_sales l JOIN invoices i ON i.id=l.invoice_id WHERE l.sale_id=s.id AND i.status='ISSUED' LIMIT 1) invoice_id,(SELECT i.invoice_number FROM invoice_sales l JOIN invoices i ON i.id=l.invoice_id WHERE l.sale_id=s.id AND i.status='ISSUED' LIMIT 1) invoice_number FROM sales s LEFT JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.created_by WHERE ${where} ORDER BY s.sale_date DESC,s.completed_at DESC,s.id DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit, offset: (page - 1) * limit });
  const gross = Number(summary.gross_amount),
    returns = Number(summary.return_amount);
  return {
    items,
    pagination: {
      page,
      limit,
      total: Number(summary.count),
      pages: Math.max(1, Math.ceil(Number(summary.count) / limit)),
    },
    summary: {
      count: Number(summary.count),
      total_amount: gross,
      gross_amount: gross,
      return_amount: returns,
      net_amount: gross - returns,
    },
  };
}
function options(query, user) {
  const warehouse = authorizeWarehouse(query.warehouse_id, user);
  return {
    sellers: db
      .prepare(
        "SELECT DISTINCT u.id,u.name FROM users u JOIN sales s ON s.created_by=u.id WHERE s.warehouse_id=? AND s.sale_status='CONFIRMED' ORDER BY u.name COLLATE NOCASE",
      )
      .all(warehouse.id),
    payment_methods: db
      .prepare(
        "SELECT DISTINCT pm.code,pm.name FROM payment_methods pm JOIN sale_payments p ON p.payment_method_code=pm.code JOIN sales s ON s.id=p.sale_id WHERE s.warehouse_id=? AND s.sale_status='CONFIRMED' ORDER BY pm.sort_order,pm.name",
      )
      .all(warehouse.id),
  };
}
function detail(id, user) {
  const sale = db
    .prepare(
      `SELECT s.*,s.sale_number document_number,w.name warehouse_name,w.phone warehouse_phone,w.email warehouse_email,w.address warehouse_address,w.nif warehouse_nif,w.nis warehouse_nis,w.rib warehouse_rib,w.tax_article warehouse_tax_article,w.commercial_register warehouse_commercial_register,w.business_activity warehouse_business_activity,c.name customer_name,c.phone customer_phone,c.email customer_email,c.address customer_address,c.nif customer_nif,c.nis customer_nis,c.rib customer_rib,c.tax_article customer_tax_article,c.commercial_register customer_commercial_register,c.business_activity customer_business_activity,u.name seller_name,cr.name cash_register_name FROM sales s JOIN warehouses w ON w.id=s.warehouse_id LEFT JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.created_by LEFT JOIN cash_registers cr ON cr.id=s.cash_register_id WHERE s.id=? AND s.sale_status<>'DRAFT'`,
    )
    .get(Number(id));
  if (!sale) throw new SalesError("Sale not found", 404);
  sale.sale_date = sale.sale_date || String(sale.completed_at || sale.created_at || "").slice(0, 10);
  authorizeWarehouse(sale.warehouse_id, user);
  sale.lines = db
    .prepare(
      `SELECT sl.*,COALESCE(p.track_stock,0) track_stock,
       COALESCE(p.track_batches,0) track_batches,
       COALESCE(p.track_expiration,0) track_expiration,
       COALESCE(p.track_serials,0) track_serials,
       COALESCE(ps.quantity,0) stock_quantity,p.min_stock
       FROM sale_lines sl
       LEFT JOIN products p ON p.id=sl.product_id
       LEFT JOIN product_stock ps ON ps.product_id=sl.product_id AND ps.warehouse_id=?
       WHERE sl.sale_id=? ORDER BY sl.id`,
    )
    .all(sale.warehouse_id, sale.id)
    .map((line) => {
      const serials = db
        .prepare(
          `SELECT ss.id,ss.serial_number,ss.status
           FROM sale_serial_allocations a
           JOIN stock_serials ss ON ss.id=a.serial_id
           WHERE a.sale_line_id=? ORDER BY a.id`,
        )
        .all(line.id);
      const batches = db
        .prepare(
          `SELECT a.batch_id,a.quantity,b.batch_number,b.expiration_date,
             MAX(0,a.quantity-COALESCE((SELECT SUM(rba.quantity)
               FROM sales_return_batch_allocations rba
               JOIN sales_return_lines srl ON srl.id=rba.sales_return_line_id
               JOIN sales_returns sr ON sr.id=srl.return_id
               WHERE srl.sale_line_id=a.sale_line_id AND rba.batch_id=a.batch_id
                 AND sr.status='VALIDATED'),0)) returnable_quantity
           FROM sale_batch_allocations a
           JOIN stock_batches b ON b.id=a.batch_id
           WHERE a.sale_line_id=? ORDER BY a.id`,
        )
        .all(line.id);
      return {
        ...line,
        serial_ids: serials.map((serial) => serial.id),
        serial_numbers: serials.map((serial) => serial.serial_number),
        serials,
        returnable_serials: serials.filter(
          (serial) => serial.status === "SOLD",
        ),
        batch_allocations: batches,
        batch_id: batches.length === 1 ? batches[0].batch_id : null,
        batch_number: batches.length === 1 ? batches[0].batch_number : null,
      };
    });
  sale.payments = db
    .prepare(
      "SELECT p.*,pm.name payment_method_name FROM sale_payments p JOIN payment_methods pm ON pm.code=p.payment_method_code WHERE p.sale_id=? ORDER BY p.id",
    )
    .all(sale.id);
  sale.deliveries = db
    .prepare("SELECT * FROM deliveries WHERE sale_id=? ORDER BY id")
    .all(sale.id);
  sale.returns = db
    .prepare(
      "SELECT r.*,u.name validated_by_name,cn.id credit_note_id,cn.credit_note_number,cn.total credit_note_total FROM sales_returns r LEFT JOIN users u ON u.id=r.validated_by LEFT JOIN invoice_credit_notes cn ON cn.sales_return_id=r.id WHERE r.sale_id=? ORDER BY r.id",
    )
    .all(sale.id);
  sale.payment_summary = SalePayment.paymentSummary(sale.id, sale.total);
  sale.invoice = db.prepare(`SELECT i.* FROM invoice_sales l JOIN invoices i ON i.id=l.invoice_id WHERE l.sale_id=? AND i.status='ISSUED' LIMIT 1`).get(sale.id) || null;
  sale.customer_credit_amount = Number(
    db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) amount FROM customer_account_entries WHERE sale_id=? AND entry_type='SALE_CREDIT'",
      )
      .get(sale.id).amount,
  );
  sale.lines = sale.lines.map((line) => {
    const delivered = Number(
        db
          .prepare(
            "SELECT COALESCE(SUM(dl.quantity),0) quantity FROM delivery_lines dl JOIN deliveries d ON d.id=dl.delivery_id WHERE dl.sale_line_id=? AND d.status IN ('SHIPPED','DELIVERED')",
          )
          .get(line.id).quantity,
      ),
      returned = Number(
        db
          .prepare(
            "SELECT COALESCE(SUM(rl.quantity),0) quantity FROM sales_return_lines rl JOIN sales_returns r ON r.id=rl.return_id WHERE rl.sale_line_id=? AND r.status='VALIDATED'",
          )
          .get(line.id).quantity,
      ),
      fulfilled =
        sale.fulfillment_type === "IMMEDIATE"
          ? Number(line.quantity)
          : delivered;
    return {
      ...line,
      delivered_quantity: delivered,
      remaining_delivery_quantity: Math.max(
        0,
        Number(line.quantity) - delivered,
      ),
      returned_quantity: returned,
      returnable_quantity: Math.max(0, fulfilled - returned),
    };
  });
  sale.delivery_summary = {
    status:
      sale.fulfillment_type === "IMMEDIATE"
        ? null
        : sale.deliveries.at(-1)?.status || "PREPARED",
    delivered_quantity: sale.lines.reduce(
      (n, l) => n + l.delivered_quantity,
      0,
    ),
    remaining_quantity: sale.lines.reduce(
      (n, l) => n + l.remaining_delivery_quantity,
      0,
    ),
  };
  const returnTotal = sale.returns
    .filter((r) => r.status === "VALIDATED")
    .reduce((n, r) => n + Number(r.return_total), 0);
  sale.return_summary = {
    status: sale.return_status,
    returned_quantity: sale.lines.reduce((n, l) => n + l.returned_quantity, 0),
    returnable_quantity: sale.lines.reduce(
      (n, l) => n + l.returnable_quantity,
      0,
    ),
    return_total: returnTotal,
    net_sales_amount: Number(sale.total) - returnTotal,
  };
  sale.print_profiles = Settings.profiles().filter(
    (p) =>
      p.is_active &&
      ["SALE_TICKET", "SALE_INVOICE", "SHIPPING_INVOICE"].includes(
        p.document_type,
      ),
  );
  sale.print_profile =
    sale.print_profiles.find((p) => p.document_type === "SALE_INVOICE") ||
    Settings.profiles().find(
      (p) => p.is_active && p.document_type === "SALE",
    ) ||
    null;
  return sale;
}
module.exports = { SalesError, list, options, detail };
