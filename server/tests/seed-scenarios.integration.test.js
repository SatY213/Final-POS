const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Analytics = require("../services/analytics.service");

const count = (sql, ...params) => Number(db.prepare(sql).get(...params).count);
const north = db
  .prepare(
    "SELECT id FROM warehouses WHERE name LIKE 'MODERN%' ORDER BY id LIMIT 1",
  )
  .get();
const admin = db
  .prepare("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1")
  .get();
assert.ok(north?.id && admin?.id, "The fictional seed must be installed");

assert.equal(count("SELECT COUNT(*) count FROM warehouses"), 2);
assert.equal(count("SELECT COUNT(*) count FROM cash_registers"), 3);
assert.equal(count("SELECT COUNT(*) count FROM products"), 200);
assert.ok(
  count("SELECT COUNT(*) count FROM sales WHERE sale_status='CONFIRMED'") >= 50,
);
assert.ok(count("SELECT COUNT(*) count FROM purchase_orders") >= 20);
assert.ok(count("SELECT COUNT(*) count FROM purchase_receipts") >= 35);
assert.ok(count("SELECT COUNT(*) count FROM invoices") >= 10);
assert.ok(
  count(
    "SELECT COUNT(*) count FROM financial_transactions WHERE source_type='PURCHASE_PAYMENT'",
  ) >= 20,
);
assert.ok(count("SELECT COUNT(DISTINCT sale_date) count FROM sales") >= 20);
assert.ok(
  count("SELECT COUNT(DISTINCT receipt_date) count FROM purchase_receipts") >=
    20,
);
assert.equal(
  count(
    "SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name LIKE 'supplier_invoice%'",
  ),
  0,
);
assert.equal(
  count(
    "SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name LIKE 'supplier_payment%'",
  ),
  0,
);
assert.ok(count("SELECT COUNT(*) count FROM financial_transactions") > 0);
assert.ok(count("SELECT COUNT(*) count FROM cash_movements") > 0);
assert.ok(count("SELECT COUNT(*) count FROM stock_movements") > 0);
assert.equal(
  count(
    "SELECT COUNT(*) count FROM stock_serials WHERE serial_number LIKE 'DEMO-%' AND status='AVAILABLE'",
  ),
  9,
);
assert.ok(
  count(
    "SELECT COUNT(*) count FROM stock_batches WHERE batch_number LIKE 'LOT-SSD-%'",
  ) >= 2,
);
assert.ok(
  count("SELECT COUNT(*) count FROM sales WHERE payment_status='UNPAID'") >= 1,
);
assert.ok(
  count(
    "SELECT COUNT(*) count FROM sales WHERE payment_status='PARTIALLY_PAID'",
  ) >= 1,
);
assert.ok(
  count("SELECT COUNT(*) count FROM sales WHERE payment_status='PAID'") >= 1,
);
assert.ok(count("SELECT COUNT(*) count FROM invoice_sales") >= 1);
assert.ok(
  count("SELECT COUNT(*) count FROM sales_returns WHERE status='VALIDATED'") >=
    1,
);
assert.ok(
  count(
    "SELECT COUNT(*) count FROM supplier_returns WHERE status='VALIDATED'",
  ) >= 1,
);
assert.ok(
  count(
    "SELECT COUNT(*) count FROM purchase_orders WHERE status='NOT_RECEIVED'",
  ) >= 1,
);
assert.ok(
  count(
    "SELECT COUNT(*) count FROM purchase_orders WHERE status='PARTIALLY_RECEIVED'",
  ) >= 1,
);
assert.ok(
  count("SELECT COUNT(*) count FROM purchase_orders WHERE status='RECEIVED'") >=
    1,
);
assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
assert.equal(db.pragma("foreign_key_check").length, 0);

const today = new Date().toISOString().slice(0, 10);
const dashboard = Analytics.dashboard(
  { start: today, end: today, warehouse_id: north.id },
  { id: admin.id, role: "admin", warehouse_id: north.id, warehouse_ids: [] },
);
const gross = Number(
  db
    .prepare(
      "SELECT COALESCE(SUM(total),0) value FROM sales WHERE sale_status='CONFIRMED' AND warehouse_id=? AND date(sale_date)=?",
    )
    .get(north.id, today).value,
);
const returned = Number(
  db
    .prepare(
      "SELECT COALESCE(SUM(return_total),0) value FROM sales_returns WHERE status='VALIDATED' AND warehouse_id=? AND date(return_date)=?",
    )
    .get(north.id, today).value,
);
assert.equal(dashboard.overview.gross_sales, gross);
assert.equal(dashboard.overview.customer_returns, returned);
assert.equal(dashboard.overview.revenue, gross - returned);
assert.ok(dashboard.overview.low_stock_count >= 2);
assert.ok(
  dashboard.alerts.some(
    (item) => item.type === "CUSTOMER_DUE" && item.value > 0,
  ),
);
assert.ok(
  dashboard.alerts.some(
    (item) => item.type === "SUPPLIER_DUE" && item.value > 0,
  ),
);
console.log(
  `Seed scenarios passed: today's warehouse revenue ${dashboard.overview.revenue}; ${dashboard.overview.low_stock_count} low/out-of-stock products.`,
);
