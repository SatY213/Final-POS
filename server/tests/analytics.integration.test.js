const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Analytics = require("../services/analytics.service");
const Exchange = require("../services/data-exchange.service");
const Invoice = require("../services/invoice.service");

const admin = db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").get();
const warehouse = db.prepare("SELECT id FROM warehouses WHERE is_active=1 ORDER BY id LIMIT 1").get();
assert.ok(admin?.id && warehouse?.id, "Seeded admin and warehouse are required");

const user = { id: admin.id, role: "admin", warehouse_id: warehouse.id, warehouse_ids: [] };
const range = { start: "2000-01-01", end: "2999-12-31", warehouse_id: warehouse.id };

for (const category of [
  "overview",
  "sales",
  "purchases",
  "customers",
  "suppliers",
  "stock",
  "finance",
]) {
  const result = Analytics.report({ ...range, category }, user);
  assert.equal(result.category, category);
  assert.ok(result.overview, `${category} report must expose reconciled KPIs`);
}

const expectedGrossSales = Number(
  db
    .prepare(
      `SELECT COALESCE(SUM(total),0) value FROM sales
       WHERE sale_status='CONFIRMED' AND warehouse_id=?
         AND date(sale_date) BETWEEN ? AND ?`,
    )
    .get(warehouse.id, range.start, range.end).value,
);
const expectedReturns = Number(
  db
    .prepare(
      `SELECT COALESCE(SUM(return_total),0) value FROM sales_returns
       WHERE status='VALIDATED' AND warehouse_id=?
         AND date(return_date) BETWEEN ? AND ?`,
    )
    .get(warehouse.id, range.start, range.end).value,
);
const overview = Analytics.report({ ...range, category: "overview" }, user).overview;
assert.equal(overview.gross_sales, expectedGrossSales);
assert.equal(overview.customer_returns, expectedReturns);
assert.equal(overview.revenue, expectedGrossSales - expectedReturns);
const invoiceBalances = db.prepare(
  `SELECT id FROM invoices WHERE status='ISSUED' AND warehouse_id=?
   AND date(invoice_date) BETWEEN ? AND ?`,
).all(warehouse.id, range.start, range.end)
  .reduce((sum, row) => sum + Invoice.detail(row.id, user).balance_due, 0);
const uninvoicedBalance = Number(db.prepare(
  `SELECT COALESCE(SUM(MAX(0,s.total
     - COALESCE((SELECT SUM(r.return_total) FROM sales_returns r WHERE r.sale_id=s.id AND r.status='VALIDATED'),0)
     - COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id=s.id),0)
     - COALESCE((SELECT SUM(a.amount) FROM customer_account_entries a WHERE a.sale_id=s.id AND a.entry_type='CREDIT_USAGE'),0)
   )),0) value FROM sales s WHERE s.sale_status='CONFIRMED'
   AND s.warehouse_id=? AND date(s.sale_date) BETWEEN ? AND ?
   AND NOT EXISTS(SELECT 1 FROM invoice_sales x JOIN invoices i ON i.id=x.invoice_id
                  WHERE x.sale_id=s.id AND i.status='ISSUED')`,
).get(warehouse.id, range.start, range.end).value);
assert.equal(overview.customer_receivable, Math.round((invoiceBalances + uninvoicedBalance) * 100) / 100);
const customerBalances = Analytics.report({ ...range, category: "customers" }, user).customers.balances;
assert.equal(
  Math.round(customerBalances.reduce((sum, row) => sum + row.balance_due, 0) * 100) / 100,
  overview.customer_receivable,
);
const exported = Exchange.exportCsv(
  "report",
  { ...range, category: "overview" },
  user,
);
assert.ok(exported.includes(`"revenue";"${overview.revenue}"`));
assert.ok(exported.includes(`"warehouse_id";"${warehouse.id}"`));

let completed = false;
try {
  db.transaction(() => {
    const unit = db.prepare("SELECT id FROM units WHERE is_active=1 ORDER BY id LIMIT 1").get();
    const productId = Number(
      db
        .prepare(
          `INSERT INTO products(designation,reference,unit_id,min_stock,track_stock,is_active)
           VALUES(?,?,?,?,1,1)`,
        )
        .run("Analytics product without stock row", "ANALYTICS-NO-STOCK", unit.id, 2)
        .lastInsertRowid,
    );
    db.prepare(
      `INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base,is_active)
       VALUES(?,?,1,10,15,1,1)`,
    ).run(productId, unit.id);

    const stock = Analytics.report({ ...range, category: "stock" }, user).stock;
    const row = stock.quantities.find((item) => item.id === productId);
    assert.ok(row, "A tracked product without product_stock row must remain visible");
    assert.equal(Number(row.quantity), 0);
    assert.equal(row.status, "OUT");
    assert.ok(Number(stock.summary.out_of_stock) >= 1);

    const dashboard = Analytics.dashboard(
      { start: range.start, end: range.end, warehouse_id: warehouse.id },
      user,
    );
    assert.ok(dashboard.alerts.some((item) => item.label === "Analytics product without stock row"));
    const expectedLowStock = Number(db.prepare(
      `SELECT COUNT(*) count FROM products p
       LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=?
       WHERE p.is_active=1 AND p.track_stock=1 AND p.min_stock>0
         AND COALESCE(ps.quantity,0)<=p.min_stock`,
    ).get(warehouse.id).count);
    assert.equal(dashboard.overview.low_stock_count, expectedLowStock);

    completed = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}

assert.equal(completed, true);
assert.equal(
  db.prepare("SELECT COUNT(*) count FROM products WHERE reference=?").get("ANALYTICS-NO-STOCK").count,
  0,
);
console.log("Analytics integration test passed (reports reconciled; transaction rolled back).");
