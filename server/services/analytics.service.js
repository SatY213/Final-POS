const db = require("../config/database");

class AnalyticsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const money = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function isoDate(value, fallback) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function allowedWarehouse(user, requested) {
  const id = Number(requested || 0);
  const ids = new Set(
    (user.warehouse_ids?.length
      ? user.warehouse_ids
      : [user.warehouse_id].filter(Boolean)
    ).map(Number),
  );
  if (!id) return user.role === "admin" ? null : ids.values().next().value || null;
  if (user.role !== "admin" && !ids.has(id))
    throw new AnalyticsError("Warehouse is unauthorized", 403);
  return id;
}

function filters(query = {}, user) {
  const today = localDateValue();
  const end = isoDate(query.end, today);
  const start = isoDate(query.start, end);
  if (start > end) throw new AnalyticsError("Start date must precede end date");
  return {
    start,
    end,
    warehouseId: allowedWarehouse(user, query.warehouse_id),
    categoryId: Number(query.category_id || 0) || null,
    customerId: Number(query.customer_id || 0) || null,
    supplierId: Number(query.supplier_id || 0) || null,
  };
}

function scalar(sql, params = {}) {
  const row = db.prepare(sql).get(params);
  return Number(row?.value || 0);
}

// An issued invoice replaces its source sales for the open-balance report.
// Payments remain on their original records: direct sale payments and invoice
// payments are both counted exactly once, as in Invoice.detail().
const uninvoicedSale = `NOT EXISTS(
  SELECT 1 FROM invoice_sales x JOIN invoices i ON i.id=x.invoice_id
  WHERE x.sale_id=s.id AND i.status='ISSUED'
)`;
const saleOpenBalance = `MAX(0,
  s.total
  - COALESCE((SELECT SUM(r.return_total) FROM sales_returns r WHERE r.sale_id=s.id AND r.status='VALIDATED'),0)
  - COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id=s.id),0)
  - COALESCE((SELECT SUM(a.amount) FROM customer_account_entries a WHERE a.sale_id=s.id AND a.entry_type='CREDIT_USAGE'),0)
)`;
const invoiceOpenBalance = `MAX(0,
  i.total
  - COALESCE((SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id=i.id),0)
  - COALESCE((SELECT SUM(sp.amount) FROM invoice_sales x JOIN sale_payments sp ON sp.sale_id=x.sale_id WHERE x.invoice_id=i.id AND sp.invoice_payment_id IS NULL),0)
  - COALESCE((SELECT SUM(cn.total) FROM invoice_credit_notes cn WHERE cn.invoice_id=i.id),0)
)`;

function overview(filter) {
  const params = {
    start: filter.start,
    end: filter.end,
    warehouse: filter.warehouseId,
    category: filter.categoryId,
    customer: filter.customerId,
    supplier: filter.supplierId,
  };
  const saleWhere = `s.sale_status='CONFIRMED'
    AND date(s.sale_date) BETWEEN @start AND @end
    AND (@warehouse IS NULL OR s.warehouse_id=@warehouse)
    AND (@customer IS NULL OR s.customer_id=@customer)`;
  const grossSales = scalar(
    `SELECT COALESCE(SUM(s.total),0) value FROM sales s WHERE ${saleWhere}`,
    params,
  );
  const salesCount = scalar(
    `SELECT COUNT(*) value FROM sales s WHERE ${saleWhere}`,
    params,
  );
  const customerReturns = scalar(
    `SELECT COALESCE(SUM(r.return_total),0) value
     FROM sales_returns r JOIN sales s ON s.id=r.sale_id
     WHERE r.status='VALIDATED' AND date(r.return_date) BETWEEN @start AND @end
       AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)
       AND (@customer IS NULL OR s.customer_id=@customer)`,
    params,
  );
  const paymentsReceived = scalar(
    `SELECT COALESCE(SUM(t.amount),0) value
     FROM financial_transactions t
     LEFT JOIN sale_payments sp ON sp.id=t.sale_payment_id
     LEFT JOIN sales s ON s.id=sp.sale_id
     LEFT JOIN invoice_payments ip ON ip.id=t.invoice_payment_id
     LEFT JOIN invoices i ON i.id=ip.invoice_id
     WHERE t.direction='IN' AND t.party_type='CUSTOMER'
       AND t.source_type IN ('SALE_PAYMENT','INVOICE_PAYMENT')
       AND date(t.created_at,'localtime') BETWEEN @start AND @end
       AND (@warehouse IS NULL OR COALESCE(s.warehouse_id,i.warehouse_id)=@warehouse)
       AND (@customer IS NULL OR t.customer_id=@customer)`,
    params,
  );
  const customerRefunds = scalar(
    `SELECT COALESCE(SUM(t.amount),0) value
     FROM financial_transactions t
     LEFT JOIN sales_returns r ON r.id=t.sales_return_id
     WHERE t.direction='OUT' AND t.party_type='CUSTOMER'
       AND t.source_type='CUSTOMER_RETURN_REFUND'
       AND date(t.created_at,'localtime') BETWEEN @start AND @end
       AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)
       AND (@customer IS NULL OR t.customer_id=@customer)`,
    params,
  );
  const purchases = scalar(
    `SELECT COALESCE(SUM(l.total),0) value FROM purchase_receipts r
     JOIN purchase_receipt_lines l ON l.purchase_receipt_id=r.id
     WHERE r.status='VALIDATED' AND date(r.receipt_date) BETWEEN @start AND @end
       AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)
       AND (@supplier IS NULL OR r.supplier_id=@supplier)`,
    params,
  );
  const purchaseReturns = scalar(
    `SELECT COALESCE(SUM(r.total),0) value FROM supplier_returns r
     WHERE r.status='VALIDATED' AND date(r.return_date) BETWEEN @start AND @end
       AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)
       AND (@supplier IS NULL OR r.supplier_id=@supplier)`,
    params,
  );
  const supplierPayments = scalar(
    `SELECT COALESCE(SUM(t.amount),0) value
     FROM financial_transactions t
     WHERE t.direction='OUT' AND t.party_type='SUPPLIER'
       AND t.source_type='PURCHASE_PAYMENT'
       AND date(t.created_at,'localtime') BETWEEN @start AND @end
       AND (@warehouse IS NULL OR EXISTS(SELECT 1 FROM purchase_receipts r WHERE r.id=t.purchase_receipt_id AND r.warehouse_id=@warehouse))
       AND (@supplier IS NULL OR t.supplier_id=@supplier)`,
    params,
  );
  const customerReceivable = scalar(
    `SELECT COALESCE(SUM(${saleOpenBalance}),0) value
     FROM sales s WHERE ${saleWhere} AND ${uninvoicedSale}`,
    params,
  ) + scalar(
    `SELECT COALESCE(SUM(${invoiceOpenBalance}),0) value
     FROM invoices i WHERE i.status='ISSUED'
       AND date(i.invoice_date) BETWEEN @start AND @end
       AND (@warehouse IS NULL OR i.warehouse_id=@warehouse)
       AND (@customer IS NULL OR i.customer_id=@customer)`,
    params,
  );
  const supplierPayable = scalar(
    `SELECT COALESCE(SUM(MAX(0,
       COALESCE((SELECT SUM(l.total) FROM purchase_receipt_lines l WHERE l.purchase_receipt_id=r.id),0)
       - COALESCE((SELECT SUM(ret.total) FROM supplier_returns ret WHERE ret.purchase_receipt_id=r.id AND ret.status='VALIDATED'),0)
       - COALESCE((SELECT SUM(t.amount) FROM financial_transactions t WHERE t.purchase_receipt_id=r.id AND t.source_type='PURCHASE_PAYMENT'),0)
     )),0) value
     FROM purchase_receipts r
     WHERE r.status='VALIDATED' AND date(r.receipt_date) BETWEEN @start AND @end
       AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)
       AND (@supplier IS NULL OR r.supplier_id=@supplier)`,
    params,
  );
  const cash = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN m.direction='IN' THEN m.amount ELSE 0 END),0) cash_in,
        COALESCE(SUM(CASE WHEN m.direction='OUT' THEN m.amount ELSE 0 END),0) cash_out,
        COUNT(*) movement_count
       FROM cash_movements m
       JOIN cash_sessions cs ON cs.id=m.cash_session_id
       JOIN cash_registers cr ON cr.id=cs.cash_register_id
       WHERE date(m.created_at,'localtime') BETWEEN @start AND @end
         AND (@warehouse IS NULL OR cr.warehouse_id=@warehouse)`,
    )
    .get(params);
  const transactionCount = scalar(
    `SELECT COUNT(*) value FROM financial_transactions t
     LEFT JOIN sale_payments sp ON sp.id=t.sale_payment_id
     LEFT JOIN sales s ON s.id=sp.sale_id
     LEFT JOIN invoice_payments ip ON ip.id=t.invoice_payment_id
     LEFT JOIN invoices i ON i.id=ip.invoice_id
     LEFT JOIN purchase_receipts pr ON pr.id=t.purchase_receipt_id
     LEFT JOIN supplier_returns sr ON sr.id=t.supplier_return_id
     LEFT JOIN sales_returns cr ON cr.id=t.sales_return_id
     WHERE date(t.created_at,'localtime') BETWEEN @start AND @end
       AND t.source_type IN ('SALE_PAYMENT','INVOICE_PAYMENT','PURCHASE_PAYMENT','CUSTOMER_RETURN_REFUND','SUPPLIER_RETURN_REFUND')
       AND (@warehouse IS NULL OR COALESCE(s.warehouse_id,i.warehouse_id,pr.warehouse_id,sr.warehouse_id,cr.warehouse_id)=@warehouse)`,
    params,
  );
  return {
    gross_sales: money(grossSales),
    customer_returns: money(customerReturns),
    revenue: money(grossSales - customerReturns),
    sales_count: salesCount,
    average_basket: salesCount ? money((grossSales - customerReturns) / salesCount) : 0,
    payments_received: money(paymentsReceived),
    customer_refunds: money(customerRefunds),
    customer_receivable: money(customerReceivable),
    purchases: money(purchases),
    supplier_returns: money(purchaseReturns),
    supplier_payments: money(supplierPayments),
    supplier_payable: money(supplierPayable),
    transaction_count: transactionCount,
    cash_in: money(cash.cash_in),
    cash_out: money(cash.cash_out),
    net_cash: money(Number(cash.cash_in) - Number(cash.cash_out)),
    cash_movement_count: Number(cash.movement_count),
  };
}

function salesAnalysis(filter) {
  const p = {
    start: filter.start,
    end: filter.end,
    warehouse: filter.warehouseId,
    category: filter.categoryId,
    customer: filter.customerId,
  };
  const base = `s.sale_status='CONFIRMED' AND date(s.sale_date) BETWEEN @start AND @end
    AND (@warehouse IS NULL OR s.warehouse_id=@warehouse)
    AND (@customer IS NULL OR s.customer_id=@customer)`;
  return {
    timeline: db.prepare(
      `SELECT date(s.sale_date) label,ROUND(SUM(s.total),2) value,COUNT(*) count
       FROM sales s WHERE ${base} GROUP BY date(s.sale_date) ORDER BY label`,
    ).all(p),
    products: db.prepare(
      `SELECT l.product_id id,l.designation label,ROUND(SUM(l.quantity),3) quantity,ROUND(SUM(l.total),2) value
       FROM sale_lines l JOIN sales s ON s.id=l.sale_id LEFT JOIN products pr ON pr.id=l.product_id
       WHERE ${base} AND (@category IS NULL OR pr.category_id=@category)
       GROUP BY l.product_id,l.designation ORDER BY value DESC LIMIT 15`,
    ).all(p),
    categories: db.prepare(
      `SELECT COALESCE(c.name,'Sans catégorie') label,ROUND(SUM(l.total),2) value
       FROM sale_lines l JOIN sales s ON s.id=l.sale_id LEFT JOIN products pr ON pr.id=l.product_id LEFT JOIN categories c ON c.id=pr.category_id
       WHERE ${base} AND (@category IS NULL OR pr.category_id=@category)
       GROUP BY pr.category_id ORDER BY value DESC`,
    ).all(p),
    customers: db.prepare(
      `SELECT s.customer_id id,COALESCE(c.name,'Client comptoir') label,COUNT(*) count,ROUND(SUM(s.total),2) value
       FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE ${base}
       GROUP BY s.customer_id ORDER BY value DESC LIMIT 15`,
    ).all(p),
    warehouses: db.prepare(
      `SELECT s.warehouse_id id,w.name label,COUNT(*) count,ROUND(SUM(s.total),2) value
       FROM sales s JOIN warehouses w ON w.id=s.warehouse_id WHERE ${base}
       GROUP BY s.warehouse_id ORDER BY value DESC`,
    ).all(p),
    payment_methods: db.prepare(
      `SELECT COALESCE(pm.name,t.payment_method_code) label,ROUND(SUM(t.amount),2) value,COUNT(*) count
       FROM financial_transactions t
       LEFT JOIN payment_methods pm ON pm.code=t.payment_method_code
       LEFT JOIN sale_payments sp ON sp.id=t.sale_payment_id LEFT JOIN sales s ON s.id=sp.sale_id
       LEFT JOIN invoice_payments ip ON ip.id=t.invoice_payment_id LEFT JOIN invoices i ON i.id=ip.invoice_id
       WHERE t.direction='IN' AND t.party_type='CUSTOMER' AND t.source_type IN ('SALE_PAYMENT','INVOICE_PAYMENT')
         AND date(t.created_at,'localtime') BETWEEN @start AND @end
         AND (@warehouse IS NULL OR COALESCE(s.warehouse_id,i.warehouse_id)=@warehouse)
         AND (@customer IS NULL OR t.customer_id=@customer)
       GROUP BY t.payment_method_code ORDER BY value DESC`,
    ).all(p),
  };
}

function purchasesAnalysis(filter) {
  const p = {
    start: filter.start,
    end: filter.end,
    warehouse: filter.warehouseId,
    supplier: filter.supplierId,
    category: filter.categoryId,
  };
  const base = `r.status='VALIDATED' AND date(r.receipt_date) BETWEEN @start AND @end
    AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)
    AND (@supplier IS NULL OR r.supplier_id=@supplier)`;
  return {
    timeline: db.prepare(
      `SELECT date(r.receipt_date) label,ROUND(SUM(l.total),2) value,COUNT(DISTINCT r.id) count
       FROM purchase_receipts r JOIN purchase_receipt_lines l ON l.purchase_receipt_id=r.id
       WHERE ${base} GROUP BY date(r.receipt_date) ORDER BY label`,
    ).all(p),
    suppliers: db.prepare(
      `SELECT r.supplier_id id,s.name label,COUNT(DISTINCT r.id) count,ROUND(SUM(l.total),2) value
       FROM purchase_receipts r JOIN purchase_receipt_lines l ON l.purchase_receipt_id=r.id
       JOIN suppliers s ON s.id=r.supplier_id WHERE ${base}
       GROUP BY r.supplier_id ORDER BY value DESC LIMIT 15`,
    ).all(p),
    products: db.prepare(
      `SELECT l.product_id id,l.designation label,ROUND(SUM(l.quantity),3) quantity,ROUND(SUM(l.total),2) value
       FROM purchase_receipt_lines l JOIN purchase_receipts r ON r.id=l.purchase_receipt_id
       LEFT JOIN products pr ON pr.id=l.product_id
       WHERE ${base} AND (@category IS NULL OR pr.category_id=@category)
       GROUP BY l.product_id,l.designation ORDER BY value DESC LIMIT 15`,
    ).all(p),
    categories: db.prepare(
      `SELECT COALESCE(c.name,'Sans catégorie') label,ROUND(SUM(l.total),2) value
       FROM purchase_receipt_lines l JOIN purchase_receipts r ON r.id=l.purchase_receipt_id
       LEFT JOIN products pr ON pr.id=l.product_id LEFT JOIN categories c ON c.id=pr.category_id
       WHERE ${base} AND (@category IS NULL OR pr.category_id=@category)
       GROUP BY pr.category_id ORDER BY value DESC`,
    ).all(p),
    orders: db.prepare(
      `SELECT o.status label,COUNT(*) count,ROUND(COALESCE(SUM((SELECT SUM(l.total) FROM purchase_order_lines l WHERE l.purchase_order_id=o.id)),0),2) value
       FROM purchase_orders o WHERE date(o.order_date) BETWEEN @start AND @end
         AND (@warehouse IS NULL OR o.warehouse_id=@warehouse)
         AND (@supplier IS NULL OR o.supplier_id=@supplier)
       GROUP BY o.status ORDER BY count DESC`,
    ).all(p),
    receipts: db.prepare(
      `SELECT r.status label,COUNT(*) count,ROUND(COALESCE(SUM((SELECT SUM(l.total) FROM purchase_receipt_lines l WHERE l.purchase_receipt_id=r.id)),0),2) value
       FROM purchase_receipts r WHERE date(r.receipt_date) BETWEEN @start AND @end
         AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)
         AND (@supplier IS NULL OR r.supplier_id=@supplier)
       GROUP BY r.status ORDER BY count DESC`,
    ).all(p),
    received_products: db.prepare(
      `SELECT l.product_id id,l.designation label,ROUND(SUM(l.quantity),3) quantity
       FROM purchase_receipt_lines l JOIN purchase_receipts r ON r.id=l.purchase_receipt_id
       LEFT JOIN products pr ON pr.id=l.product_id
       WHERE ${base} AND (@category IS NULL OR pr.category_id=@category)
       GROUP BY l.product_id,l.designation ORDER BY quantity DESC LIMIT 15`,
    ).all(p),
  };
}
function stockAnalysis(filter) {
  const p = { warehouse: filter.warehouseId };
  const stockBase = `FROM products p
    JOIN warehouses w ON w.is_active=1 AND (@warehouse IS NULL OR w.id=@warehouse)
    LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=w.id
    LEFT JOIN product_units pu ON pu.product_id=p.id AND pu.is_base=1
    WHERE p.is_active=1 AND p.track_stock=1`;
  return {
    summary: db.prepare(
      `SELECT COUNT(*) tracked_products,
        SUM(CASE WHEN COALESCE(ps.quantity,0)<=0 THEN 1 ELSE 0 END) out_of_stock,
        SUM(CASE WHEN p.min_stock>0 AND COALESCE(ps.quantity,0)>0 AND COALESCE(ps.quantity,0)<=p.min_stock THEN 1 ELSE 0 END) low_stock,
        ROUND(COALESCE(SUM(COALESCE(ps.quantity,0)*COALESCE(pu.purchase_price,0)),0),2) stock_value
       ${stockBase}`,
    ).get(p),
    quantities: db.prepare(
      `SELECT p.id,p.designation label,w.name warehouse_name,ROUND(COALESCE(ps.quantity,0),3) quantity,p.min_stock,
        CASE WHEN COALESCE(ps.quantity,0)<=0 THEN 'OUT' WHEN p.min_stock>0 AND ps.quantity<=p.min_stock THEN 'LOW' ELSE 'OK' END status
       ${stockBase} ORDER BY CASE status WHEN 'OUT' THEN 0 WHEN 'LOW' THEN 1 ELSE 2 END,p.designation,w.name LIMIT 100`,
    ).all(p),
    movements: db.prepare(
      `SELECT p.designation label,COUNT(*) count,ROUND(SUM(ABS(m.quantity)),3) quantity
       FROM stock_movements m JOIN products p ON p.id=m.product_id
       WHERE date(m.created_at,'localtime') BETWEEN @start AND @end
         AND (@warehouse IS NULL OR m.warehouse_id=@warehouse)
       GROUP BY m.product_id ORDER BY quantity DESC LIMIT 15`,
    ).all({ ...p, start: filter.start, end: filter.end }),
    expirations: db.prepare(
      `SELECT p.designation label,b.batch_number,b.expiration_date,b.quantity,w.name warehouse_name
       FROM stock_batches b JOIN products p ON p.id=b.product_id JOIN warehouses w ON w.id=b.warehouse_id
       WHERE b.quantity>0 AND b.expiration_date IS NOT NULL
         AND (@warehouse IS NULL OR b.warehouse_id=@warehouse)
       ORDER BY b.expiration_date LIMIT 50`,
    ).all(p),
  };
}

function financeAnalysis(filter) {
  const p = { start: filter.start, end: filter.end, warehouse: filter.warehouseId };
  return {
    cash_timeline: db.prepare(
      `SELECT date(m.created_at,'localtime') label,
        ROUND(SUM(CASE WHEN m.direction='IN' THEN m.amount ELSE 0 END),2) cash_in,
        ROUND(SUM(CASE WHEN m.direction='OUT' THEN m.amount ELSE 0 END),2) cash_out
       FROM cash_movements m JOIN cash_sessions cs ON cs.id=m.cash_session_id JOIN cash_registers cr ON cr.id=cs.cash_register_id
       WHERE date(m.created_at,'localtime') BETWEEN @start AND @end AND (@warehouse IS NULL OR cr.warehouse_id=@warehouse)
       GROUP BY date(m.created_at,'localtime') ORDER BY label`,
    ).all(p),
    payment_methods: db.prepare(
      `SELECT COALESCE(pm.name,t.payment_method_code) label,t.direction,ROUND(SUM(t.amount),2) value,COUNT(*) count
       FROM financial_transactions t LEFT JOIN payment_methods pm ON pm.code=t.payment_method_code
       LEFT JOIN sale_payments sp ON sp.id=t.sale_payment_id LEFT JOIN sales s ON s.id=sp.sale_id
       LEFT JOIN invoice_payments ip ON ip.id=t.invoice_payment_id LEFT JOIN invoices i ON i.id=ip.invoice_id
       LEFT JOIN purchase_receipts pr ON pr.id=t.purchase_receipt_id
       LEFT JOIN supplier_returns sr ON sr.id=t.supplier_return_id
       LEFT JOIN sales_returns cr ON cr.id=t.sales_return_id
       WHERE date(t.created_at,'localtime') BETWEEN @start AND @end
         AND t.source_type IN ('SALE_PAYMENT','INVOICE_PAYMENT','PURCHASE_PAYMENT','CUSTOMER_RETURN_REFUND','SUPPLIER_RETURN_REFUND')
         AND (@warehouse IS NULL OR COALESCE(s.warehouse_id,i.warehouse_id,pr.warehouse_id,sr.warehouse_id,cr.warehouse_id)=@warehouse)
       GROUP BY t.payment_method_code,t.direction ORDER BY value DESC`,
    ).all(p),
    registers: db.prepare(
      `SELECT cr.id,cr.name label,COUNT(m.id) count,
        ROUND(COALESCE(SUM(CASE WHEN m.direction='IN' THEN m.amount ELSE -m.amount END),0),2) value
       FROM cash_registers cr LEFT JOIN cash_sessions cs ON cs.cash_register_id=cr.id
       LEFT JOIN cash_movements m ON m.cash_session_id=cs.id AND date(m.created_at,'localtime') BETWEEN @start AND @end
       WHERE (@warehouse IS NULL OR cr.warehouse_id=@warehouse)
       GROUP BY cr.id ORDER BY value DESC`,
    ).all(p),
  };
}

function customersAnalysis(filter) {
  const p = {
    start: filter.start,
    end: filter.end,
    warehouse: filter.warehouseId,
    customer: filter.customerId,
  };
  return {
    balances: db.prepare(
      `WITH sale_balances AS (
         SELECT s.customer_id,COUNT(*) sales_count,SUM(s.total) sales_total,
           SUM(CASE WHEN ${uninvoicedSale} THEN ${saleOpenBalance} ELSE 0 END) open_balance
         FROM sales s WHERE s.sale_status='CONFIRMED'
           AND date(s.sale_date) BETWEEN @start AND @end
           AND (@warehouse IS NULL OR s.warehouse_id=@warehouse)
         GROUP BY s.customer_id
       ), invoice_balances AS (
         SELECT i.customer_id,SUM(${invoiceOpenBalance}) open_balance
         FROM invoices i WHERE i.status='ISSUED'
           AND date(i.invoice_date) BETWEEN @start AND @end
           AND (@warehouse IS NULL OR i.warehouse_id=@warehouse)
         GROUP BY i.customer_id
       )
       SELECT c.id,c.name label,COALESCE(sb.sales_count,0) sales_count,
         ROUND(COALESCE(sb.sales_total,0),2) sales_total,
         ROUND(COALESCE(sb.open_balance,0)+COALESCE(ib.open_balance,0),2) balance_due
       FROM customers c
       LEFT JOIN sale_balances sb ON sb.customer_id=c.id
       LEFT JOIN invoice_balances ib ON ib.customer_id=c.id
       WHERE (@customer IS NULL OR c.id=@customer)
         AND (COALESCE(sb.sales_count,0)>0 OR COALESCE(sb.open_balance,0)+COALESCE(ib.open_balance,0)>0)
       ORDER BY balance_due DESC,sales_total DESC LIMIT 100`,
    ).all(p),
    payments: db.prepare(
      `SELECT c.id,c.name label,COUNT(t.id) count,ROUND(COALESCE(SUM(t.amount),0),2) value
       FROM financial_transactions t JOIN customers c ON c.id=t.customer_id
       LEFT JOIN sale_payments sp ON sp.id=t.sale_payment_id LEFT JOIN sales s ON s.id=sp.sale_id
       LEFT JOIN invoice_payments ip ON ip.id=t.invoice_payment_id LEFT JOIN invoices i ON i.id=ip.invoice_id
       WHERE t.direction='IN' AND t.party_type='CUSTOMER'
         AND t.source_type IN ('SALE_PAYMENT','INVOICE_PAYMENT')
         AND date(t.created_at,'localtime') BETWEEN @start AND @end
         AND (@warehouse IS NULL OR COALESCE(s.warehouse_id,i.warehouse_id)=@warehouse)
         AND (@customer IS NULL OR c.id=@customer)
       GROUP BY c.id ORDER BY value DESC LIMIT 50`,
    ).all(p),
  };
}

function suppliersAnalysis(filter) {
  const p = {
    start: filter.start,
    end: filter.end,
    warehouse: filter.warehouseId,
    supplier: filter.supplierId,
  };
  return {
    balances: db.prepare(
      `WITH receipt_balances AS (
         SELECT r.supplier_id,COUNT(*) receipt_count,
           SUM(COALESCE((SELECT SUM(l.total) FROM purchase_receipt_lines l WHERE l.purchase_receipt_id=r.id),0)) purchase_total,
           SUM(MAX(0,
             COALESCE((SELECT SUM(l.total) FROM purchase_receipt_lines l WHERE l.purchase_receipt_id=r.id),0)
             - COALESCE((SELECT SUM(ret.total) FROM supplier_returns ret WHERE ret.purchase_receipt_id=r.id AND ret.status='VALIDATED'),0)
             - COALESCE((SELECT SUM(t.amount) FROM financial_transactions t WHERE t.purchase_receipt_id=r.id AND t.source_type='PURCHASE_PAYMENT'),0)
           )) balance_due
         FROM purchase_receipts r WHERE r.status='VALIDATED'
           AND date(r.receipt_date) BETWEEN @start AND @end
           AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)
         GROUP BY r.supplier_id
       )
       SELECT s.id,s.name label,COALESCE(rb.receipt_count,0) receipt_count,
         ROUND(COALESCE(rb.purchase_total,0),2) purchase_total,
         ROUND(COALESCE(rb.balance_due,0),2) balance_due
       FROM suppliers s LEFT JOIN receipt_balances rb ON rb.supplier_id=s.id
       WHERE (@supplier IS NULL OR s.id=@supplier)
         AND (COALESCE(rb.receipt_count,0)>0 OR COALESCE(rb.balance_due,0)>0)
       ORDER BY balance_due DESC,purchase_total DESC LIMIT 100`,
    ).all(p),
    payments: db.prepare(
      `SELECT s.id,s.name label,COUNT(t.id) count,ROUND(COALESCE(SUM(t.amount),0),2) value
       FROM financial_transactions t JOIN suppliers s ON s.id=t.supplier_id
       JOIN purchase_receipts r ON r.id=t.purchase_receipt_id
       WHERE t.direction='OUT' AND t.party_type='SUPPLIER' AND t.source_type='PURCHASE_PAYMENT'
         AND date(t.created_at,'localtime') BETWEEN @start AND @end
         AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)
         AND (@supplier IS NULL OR s.id=@supplier)
       GROUP BY s.id ORDER BY value DESC LIMIT 50`,
    ).all(p),
  };
}
function recentActivity(filter, limit = 8) {
  return db.prepare(
    `SELECT t.id,t.created_at,t.direction,t.source_type,t.amount,
      COALESCE(c.name,sup.name,'—') partner_name,
      COALESCE(s.sale_number,i.invoice_number,pr.receipt_number,sr.return_number,cr.return_number,'—') reference,
      COALESCE(pm.name,t.payment_method_code) payment_method_name
     FROM financial_transactions t
     LEFT JOIN customers c ON c.id=t.customer_id LEFT JOIN suppliers sup ON sup.id=t.supplier_id
     LEFT JOIN payment_methods pm ON pm.code=t.payment_method_code
     LEFT JOIN sale_payments sp ON sp.id=t.sale_payment_id LEFT JOIN sales s ON s.id=sp.sale_id
     LEFT JOIN invoice_payments ip ON ip.id=t.invoice_payment_id LEFT JOIN invoices i ON i.id=ip.invoice_id
     LEFT JOIN purchase_receipts pr ON pr.id=t.purchase_receipt_id
     LEFT JOIN supplier_returns sr ON sr.id=t.supplier_return_id
     LEFT JOIN sales_returns cr ON cr.id=t.sales_return_id
     WHERE t.source_type IN ('SALE_PAYMENT','INVOICE_PAYMENT','PURCHASE_PAYMENT','CUSTOMER_RETURN_REFUND','SUPPLIER_RETURN_REFUND')
       AND (@warehouse IS NULL OR COALESCE(s.warehouse_id,i.warehouse_id,pr.warehouse_id,sr.warehouse_id,cr.warehouse_id)=@warehouse)
     GROUP BY t.id ORDER BY t.created_at DESC,t.id DESC LIMIT @limit`,
  ).all({ warehouse: filter.warehouseId, limit: Math.min(25, Math.max(1, Number(limit) || 8)) });
}

function alerts(filter) {
  const stockSettings = require("./settings.service").getGroup("stock");
  const expirationSettings = require("./settings.service").getGroup("expiration");
  const params = { warehouse: filter.warehouseId };
  const result = [];
  if (stockSettings.low_stock_alert_enabled) {
    const low = db.prepare(
      `SELECT p.id,p.designation,w.id warehouse_id,w.name warehouse_name,COALESCE(ps.quantity,0) quantity,p.min_stock
       FROM products p
       JOIN warehouses w ON w.is_active=1 AND (@warehouse IS NULL OR w.id=@warehouse)
       LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=w.id
       WHERE p.is_active=1 AND p.track_stock=1 AND p.min_stock>0
         AND COALESCE(ps.quantity,0)<=p.min_stock
       ORDER BY quantity,p.designation,w.name LIMIT 8`,
    ).all(params);
    low.forEach((item) => result.push({
      type: Number(item.quantity) <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
      severity: Number(item.quantity) <= 0 ? "error" : "warning",
      label: item.designation,
      value: Number(item.quantity),
      target: "inventory",
      filter: Number(item.quantity) <= 0 ? "out_of_stock" : "low_stock",
    }));
  }
  if (expirationSettings.alert_enabled) {
    const days = Number(expirationSettings.warning_days || 30);
    db.prepare(
      `SELECT p.designation,b.batch_number,b.expiration_date,b.quantity
       FROM stock_batches b JOIN products p ON p.id=b.product_id
       WHERE b.quantity>0 AND b.expiration_date IS NOT NULL
         AND date(b.expiration_date)<=date('now',@offset)
         AND (@warehouse IS NULL OR b.warehouse_id=@warehouse)
       ORDER BY b.expiration_date LIMIT 8`,
    ).all({ ...params, offset: `+${days} days` }).forEach((item) => result.push({
      type: "EXPIRATION",
      severity: item.expiration_date < new Date().toISOString().slice(0, 10) ? "error" : "warning",
      label: `${item.designation} · ${item.batch_number}`,
      value: item.expiration_date,
      target: "inventory",
      filter: "expiration",
    }));
  }
  const customerDue = scalar(
    `SELECT COALESCE(SUM(${saleOpenBalance}),0) value FROM sales s
     WHERE s.sale_status='CONFIRMED' AND ${uninvoicedSale}
       AND (@warehouse IS NULL OR s.warehouse_id=@warehouse)`,
    params,
  ) + scalar(
    `SELECT COALESCE(SUM(${invoiceOpenBalance}),0) value FROM invoices i
     WHERE i.status='ISSUED' AND (@warehouse IS NULL OR i.warehouse_id=@warehouse)`,
    params,
  );
  if (customerDue > 0) result.push({
    type: "CUSTOMER_DUE", severity: "warning", value: money(customerDue),
    target: "sales", filters: { payment_status: "UNPAID" },
  });
  const supplierDue = scalar(
    `SELECT COALESCE(SUM(MAX(0,
       COALESCE((SELECT SUM(l.total) FROM purchase_receipt_lines l WHERE l.purchase_receipt_id=r.id),0)
       - COALESCE((SELECT SUM(ret.total) FROM supplier_returns ret WHERE ret.purchase_receipt_id=r.id AND ret.status='VALIDATED'),0)
       - COALESCE((SELECT SUM(t.amount) FROM financial_transactions t WHERE t.purchase_receipt_id=r.id AND t.source_type='PURCHASE_PAYMENT'),0)
     )),0) value FROM purchase_receipts r
     WHERE r.status='VALIDATED' AND (@warehouse IS NULL OR r.warehouse_id=@warehouse)`,
    params,
  );
  if (supplierDue > 0) result.push({
    type: "SUPPLIER_DUE", severity: "warning", value: money(supplierDue),
    target: "purchases", filters: { payment_status: "UNPAID" },
  });
  const financialAlerts = result.filter((item) => item.type === "CUSTOMER_DUE" || item.type === "SUPPLIER_DUE");
  return result.filter((item) => !financialAlerts.includes(item))
    .slice(0, 12 - financialAlerts.length)
    .concat(financialAlerts);
}

function dashboard(query, user) {
  const filter = filters(query, user);
  const overviewData = overview(filter);
  overviewData.low_stock_count = scalar(
    `SELECT COUNT(*) value FROM products p
     JOIN warehouses w ON w.is_active=1 AND (@warehouse IS NULL OR w.id=@warehouse)
     LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=w.id
     WHERE p.is_active=1 AND p.track_stock=1 AND p.min_stock>0
       AND COALESCE(ps.quantity,0)<=p.min_stock`,
    { warehouse: filter.warehouseId },
  );
  return {
    filters: filter,
    overview: overviewData,
    recent_activity: recentActivity(filter, 8),
    alerts: alerts(filter),
  };
}

function report(query, user) {
  const filter = filters(query, user);
  const category = ["overview", "sales", "purchases", "customers", "suppliers", "stock", "finance"].includes(query.category)
    ? query.category
    : "overview";
  const result = { filters: filter, category, overview: overview(filter) };
  if (category === "overview") {
    const sales = salesAnalysis(filter);
    const purchases = purchasesAnalysis(filter);
    const finance = financeAnalysis(filter);
    result.sales = { timeline: sales.timeline };
    result.purchases = { timeline: purchases.timeline };
    result.finance = { cash_timeline: finance.cash_timeline };
  }
  if (category === "sales") result.sales = salesAnalysis(filter);
  if (category === "purchases") result.purchases = purchasesAnalysis(filter);
  if (category === "customers") result.customers = customersAnalysis(filter);
  if (category === "suppliers") result.suppliers = suppliersAnalysis(filter);
  if (category === "stock") result.stock = stockAnalysis(filter);
  if (category === "finance") result.finance = financeAnalysis(filter);
  return result;
}

module.exports = { AnalyticsError, filters, overview, dashboard, report };
