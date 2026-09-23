const db = require("../../config/database");

const saleColumns = new Set(db.prepare("PRAGMA table_info(sales)").all().map((column) => column.name));
if (!saleColumns.has("document_type")) {
  db.exec("ALTER TABLE sales ADD COLUMN document_type TEXT NOT NULL DEFAULT 'TICKET'");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT UNIQUE,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    warehouse_id INTEGER NOT NULL,
    invoice_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED','CANCELLED')),
    total REAL NOT NULL DEFAULT 0,
    note TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS invoice_sales (
    invoice_id INTEGER NOT NULL,
    sale_id INTEGER NOT NULL UNIQUE,
    amount REAL NOT NULL CHECK(amount>=0),
    PRIMARY KEY(invoice_id,sale_id),
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT
  );
  CREATE INDEX IF NOT EXISTS invoice_sales_invoice ON invoice_sales(invoice_id);
  INSERT OR IGNORE INTO document_sequences(document_type,current_value) VALUES('INVOICE',0);
`);

db.prepare(
  "INSERT OR IGNORE INTO print_profiles(document_type,paper_format,configuration_json) VALUES('INVOICE','A4',?)",
).run(
  JSON.stringify({
    title: "Facture",
    show_warehouse_name: true,
    show_address: true,
    show_phone: true,
    show_legal_info: true,
    show_customer: true,
    show_product_reference: true,
    show_discounts: false,
    show_payment_details: true,
    footer_message: "",
  }),
);

const invoiceColumns = new Set(db.prepare("PRAGMA table_info(invoices)").all().map((column) => column.name));
for (const [name, definition] of [
  ["subtotal", "REAL NOT NULL DEFAULT 0"],
  ["discount_type", "TEXT NOT NULL DEFAULT 'PERCENT'"],
  ["discount_value", "REAL NOT NULL DEFAULT 0"],
  ["discount_amount", "REAL NOT NULL DEFAULT 0"],
  ["tax_enabled", "INTEGER NOT NULL DEFAULT 0"],
  ["tax_rate", "REAL NOT NULL DEFAULT 0"],
  ["tax_amount", "REAL NOT NULL DEFAULT 0"],
  ["stamp_enabled", "INTEGER NOT NULL DEFAULT 0"],
  ["stamp_rate", "REAL NOT NULL DEFAULT 0"],
  ["stamp_amount", "REAL NOT NULL DEFAULT 0"],
  ["paid_before", "REAL NOT NULL DEFAULT 0"],
]) if (!invoiceColumns.has(name)) db.exec(`ALTER TABLE invoices ADD COLUMN ${name} ${definition}`);

const paymentColumns = new Set(db.prepare("PRAGMA table_info(sale_payments)").all().map((column) => column.name));
if (!paymentColumns.has("invoice_payment_id")) db.exec("ALTER TABLE sale_payments ADD COLUMN invoice_payment_id INTEGER");

db.exec(`
  CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    sale_id INTEGER NOT NULL,
    sale_line_id INTEGER NOT NULL,
    designation TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity>0),
    unit_price REAL NOT NULL CHECK(unit_price>=0),
    discount_type TEXT NOT NULL DEFAULT 'PERCENT' CHECK(discount_type IN ('PERCENT','FIXED')),
    discount_value REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_line_id) REFERENCES sale_lines(id) ON DELETE RESTRICT
  );
  CREATE INDEX IF NOT EXISTS invoice_lines_invoice ON invoice_lines(invoice_id);
  CREATE TABLE IF NOT EXISTS invoice_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT NOT NULL UNIQUE,
    invoice_id INTEGER NOT NULL,
    payment_method_code TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount>0),
    reference TEXT,
    cash_session_id INTEGER,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    FOREIGN KEY(payment_method_code) REFERENCES payment_methods(code) ON DELETE RESTRICT,
    FOREIGN KEY(cash_session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS invoice_payment_allocations (
    invoice_payment_id INTEGER NOT NULL,
    sale_id INTEGER NOT NULL,
    sale_payment_id INTEGER NOT NULL UNIQUE,
    amount REAL NOT NULL CHECK(amount>0),
    PRIMARY KEY(invoice_payment_id,sale_id),
    FOREIGN KEY(invoice_payment_id) REFERENCES invoice_payments(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_payment_id) REFERENCES sale_payments(id) ON DELETE RESTRICT
  );
  -- A return never rewrites an issued invoice.  Its financial/fiscal impact is
  -- represented by a separate credit note linked both to the invoice and to
  -- the physical return that created it.
  CREATE TABLE IF NOT EXISTS invoice_credit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credit_note_number TEXT NOT NULL UNIQUE,
    invoice_id INTEGER NOT NULL,
    sales_return_id INTEGER NOT NULL UNIQUE,
    credit_note_date TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    stamp_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    note TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    FOREIGN KEY(sales_return_id) REFERENCES sales_returns(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS invoice_credit_note_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credit_note_id INTEGER NOT NULL,
    invoice_line_id INTEGER,
    sales_return_line_id INTEGER NOT NULL,
    quantity REAL NOT NULL CHECK(quantity>0),
    subtotal REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY(credit_note_id) REFERENCES invoice_credit_notes(id) ON DELETE RESTRICT,
    FOREIGN KEY(invoice_line_id) REFERENCES invoice_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(sales_return_line_id) REFERENCES sales_return_lines(id) ON DELETE RESTRICT
  );
  CREATE INDEX IF NOT EXISTS invoice_credit_notes_invoice ON invoice_credit_notes(invoice_id);
  INSERT OR IGNORE INTO document_sequences(document_type,current_value) VALUES('CREDIT_NOTE',0);
  DELETE FROM invoice_sales WHERE NOT EXISTS(SELECT 1 FROM sales WHERE sales.id=invoice_sales.sale_id);
  DELETE FROM invoice_payment_allocations
  WHERE NOT EXISTS(SELECT 1 FROM invoice_payments WHERE invoice_payments.id=invoice_payment_allocations.invoice_payment_id)
     OR NOT EXISTS(SELECT 1 FROM sale_payments WHERE sale_payments.id=invoice_payment_allocations.sale_payment_id)
     OR NOT EXISTS(SELECT 1 FROM sales WHERE sales.id=invoice_payment_allocations.sale_id);
`);

const returnColumns = new Set(db.prepare("PRAGMA table_info(sales_returns)").all().map((column) => column.name));
if (!returnColumns.has("invoice_id")) db.exec("ALTER TABLE sales_returns ADD COLUMN invoice_id INTEGER");
if (!returnColumns.has("settlement_mode")) db.exec("ALTER TABLE sales_returns ADD COLUMN settlement_mode TEXT NOT NULL DEFAULT 'CUSTOMER_CREDIT'");
if (!returnColumns.has("refund_amount")) db.exec("ALTER TABLE sales_returns ADD COLUMN refund_amount REAL NOT NULL DEFAULT 0");
const accountColumns = new Set(db.prepare("PRAGMA table_info(customer_account_entries)").all().map((column) => column.name));
if (!accountColumns.has("return_id")) db.exec("ALTER TABLE customer_account_entries ADD COLUMN return_id INTEGER");
if (!accountColumns.has("entry_role")) db.exec("ALTER TABLE customer_account_entries ADD COLUMN entry_role TEXT");
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS customer_account_return_role_once
    ON customer_account_entries(return_id,entry_role)
    WHERE return_id IS NOT NULL AND entry_role IS NOT NULL;
`);

db.prepare("UPDATE app_settings SET value='BON_POUR',updated_at=CURRENT_TIMESTAMP WHERE key='sales.default_print_document' AND value='SALES_INVOICE'").run();
db.prepare("UPDATE print_profiles SET configuration_json=REPLACE(configuration_json,'Facture de vente','Bon pour'),updated_at=CURRENT_TIMESTAMP WHERE configuration_json LIKE '%Facture de vente%'").run();
db.exec(`
  DELETE FROM customer_account_entries
  WHERE sale_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sales WHERE sales.id=customer_account_entries.sale_id);
  DELETE FROM customer_account_entries
  WHERE payment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sale_payments WHERE sale_payments.id=customer_account_entries.payment_id);
`);

module.exports = true;
