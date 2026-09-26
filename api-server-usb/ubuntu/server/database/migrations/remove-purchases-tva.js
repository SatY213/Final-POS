const db = require("../../config/database");

db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
const cleanupAlreadyApplied = db
  .prepare("SELECT 1 FROM schema_migrations WHERE id='remove-legacy-purchases-tva-v1'")
  .get();

function hasTable(name) {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name),
  );
}

function hasColumn(table, column) {
  return (
    hasTable(table) &&
    db
      .prepare(`PRAGMA table_info("${table}")`)
      .all()
      .some((item) => item.name === column)
  );
}

function dropColumn(table, column) {
  if (hasColumn(table, column))
    db.exec(`ALTER TABLE "${table}" DROP COLUMN "${column}"`);
}

if (!cleanupAlreadyApplied) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
  DELETE FROM cash_movements WHERE movement_type='PURCHASE_PAYMENT' OR reference_type LIKE '%PURCHASE%' OR reference_type LIKE '%SUPPLIER%';
  DELETE FROM stock_movements WHERE type IN ('PURCHASE','SUPPLIER_RETURN') OR reference_type LIKE '%PURCHASE%' OR reference_type LIKE '%SUPPLIER%';
  DROP TABLE IF EXISTS supplier_payment_allocations;
  DROP TABLE IF EXISTS supplier_credit_allocations;
  DROP TABLE IF EXISTS supplier_invoice_receipt_allocations;
  DROP TABLE IF EXISTS supplier_return_lines;
  DROP TABLE IF EXISTS supplier_refunds;
  DROP TABLE IF EXISTS supplier_credits;
  DROP TABLE IF EXISTS supplier_returns;
  DROP TABLE IF EXISTS supplier_payments;
  DROP TABLE IF EXISTS supplier_invoice_lines;
  DROP TABLE IF EXISTS supplier_invoices;
  DROP TABLE IF EXISTS purchase_audit_log;
  DROP TABLE IF EXISTS purchase_group_invoice_payments;
  DROP TABLE IF EXISTS purchase_group_invoice_lines;
  DROP TABLE IF EXISTS purchase_group_invoices;
  DROP TABLE IF EXISTS canonical_purchase_return_lines;
  DROP TABLE IF EXISTS purchase_return_documents;
  DROP TABLE IF EXISTS purchase_payments;
  DROP TABLE IF EXISTS purchase_invoices;
  DROP TABLE IF EXISTS purchase_receipt_documents;
  DROP TABLE IF EXISTS purchase_lines;
  DROP TABLE IF EXISTS purchases;
  DROP TABLE IF EXISTS purchase_return_lines;
  DROP TABLE IF EXISTS purchase_returns;
  DROP TABLE IF EXISTS purchase_receipt_lines;
  DROP TABLE IF EXISTS purchase_receipts;
  DROP TABLE IF EXISTS purchase_order_lines;
  DROP TABLE IF EXISTS purchase_orders;
  DROP TABLE IF EXISTS supplier_account_entries;
  DROP TABLE IF EXISTS suppliers;
  DELETE FROM print_profiles WHERE document_type LIKE 'PURCHASE%';
  DELETE FROM document_sequences WHERE document_type LIKE 'PURCHASE%';
  DELETE FROM warehouse_document_sequences WHERE document_type LIKE 'PURCHASE%';
  DELETE FROM app_settings WHERE key LIKE 'purchases.%' OR key='sales.tax_enabled';
`);

if (hasTable("print_profiles")) {
  const saveProfile = db.prepare(
    "UPDATE print_profiles SET configuration_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  );
  db.prepare("SELECT id,configuration_json FROM print_profiles")
    .all()
    .forEach((profile) => {
      let configuration = {};
      try {
        configuration = JSON.parse(profile.configuration_json || "{}");
      } catch {}
      delete configuration.show_tax;
      delete configuration.show_tax_details;
      saveProfile.run(JSON.stringify(configuration), profile.id);
    });
}

if (hasColumn("sale_lines", "tax_amount")) {
  db.exec("UPDATE sale_lines SET total=subtotal-discount_amount");
}
if (hasColumn("quote_lines", "tax_amount")) {
  db.exec("UPDATE quote_lines SET total=subtotal-discount_amount");
}

if (hasTable("sales_invoices")) {
  db.exec("UPDATE sales_invoices SET total=subtotal-discount_amount");
}
if (hasTable("sales_invoice_lines")) {
  db.exec("UPDATE sales_invoice_lines SET total=subtotal-discount_amount");
}

[
  ["products", "tax_rate"],
  ["sales", "tax_total"],
  ["sale_lines", "tax_rate"],
  ["sale_lines", "tax_amount"],
  ["quotes", "tax_total"],
  ["quote_lines", "tax_rate"],
  ["quote_lines", "tax_amount"],
  ["sales_invoices", "tax_amount"],
  ["sales_invoice_lines", "tax_rate"],
  ["sales_invoice_lines", "tax_amount"],
].forEach(([table, column]) => dropColumn(table, column));
  db.pragma("foreign_keys = ON");
  db.prepare("INSERT INTO schema_migrations(id) VALUES('remove-legacy-purchases-tva-v1')").run();
}
module.exports = true;
