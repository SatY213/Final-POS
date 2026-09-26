const db = require("../../config/database");

db.exec(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS suppliers_name ON suppliers(name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT UNIQUE,
    order_number TEXT NOT NULL UNIQUE,
    warehouse_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    supplier_reference TEXT,
    status TEXT NOT NULL DEFAULT 'NOT_RECEIVED' CHECK(status IN ('NOT_RECEIVED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
    note TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_unit_id INTEGER,
    designation TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    conversion_factor REAL NOT NULL DEFAULT 1 CHECK(conversion_factor>0),
    quantity REAL NOT NULL CHECK(quantity>0),
    unit_price REAL NOT NULL DEFAULT 0 CHECK(unit_price>=0),
    total REAL NOT NULL DEFAULT 0 CHECK(total>=0),
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_unit_id) REFERENCES product_units(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS purchase_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT UNIQUE,
    receipt_number TEXT NOT NULL UNIQUE,
    purchase_order_id INTEGER,
    warehouse_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    receipt_date TEXT NOT NULL,
    supplier_reference TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','VALIDATED','CANCELLED')),
    note TEXT,
    validated_at TEXT,
    validated_by INTEGER,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(validated_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS purchase_receipt_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_receipt_id INTEGER NOT NULL,
    purchase_order_line_id INTEGER,
    product_id INTEGER,
    product_unit_id INTEGER,
    designation TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    conversion_factor REAL NOT NULL DEFAULT 1 CHECK(conversion_factor>0),
    quantity REAL NOT NULL CHECK(quantity>0),
    base_quantity REAL NOT NULL CHECK(base_quantity>0),
    unit_price REAL NOT NULL DEFAULT 0 CHECK(unit_price>=0),
    total REAL NOT NULL DEFAULT 0 CHECK(total>=0),
    traceability_json TEXT,
    FOREIGN KEY(purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE RESTRICT,
    FOREIGN KEY(purchase_order_line_id) REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_unit_id) REFERENCES product_units(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS supplier_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT UNIQUE,
    return_number TEXT NOT NULL UNIQUE,
    purchase_receipt_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    return_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'VALIDATED' CHECK(status IN ('VALIDATED','CANCELLED')),
    total REAL NOT NULL DEFAULT 0 CHECK(total>=0),
    note TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE RESTRICT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS supplier_return_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_return_id INTEGER NOT NULL,
    purchase_receipt_line_id INTEGER NOT NULL,
    product_id INTEGER,
    designation TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity>0),
    base_quantity REAL NOT NULL CHECK(base_quantity>0),
    unit_price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY(supplier_return_id) REFERENCES supplier_returns(id) ON DELETE RESTRICT,
    FOREIGN KEY(purchase_receipt_line_id) REFERENCES purchase_receipt_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    UNIQUE(supplier_return_id,purchase_receipt_line_id)
  );
  CREATE TABLE IF NOT EXISTS supplier_account_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    purchase_receipt_id INTEGER,
    supplier_return_id INTEGER,
    financial_transaction_id INTEGER,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('RECEIPT_DEBT','PAYMENT','RETURN_CREDIT','ADJUSTMENT')),
    amount REAL NOT NULL CHECK(amount<>0),
    reference TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE RESTRICT,
    FOREIGN KEY(supplier_return_id) REFERENCES supplier_returns(id) ON DELETE RESTRICT,
    FOREIGN KEY(financial_transaction_id) REFERENCES financial_transactions(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE INDEX IF NOT EXISTS purchase_orders_warehouse ON purchase_orders(warehouse_id,order_date DESC);
  CREATE INDEX IF NOT EXISTS purchase_receipts_order ON purchase_receipts(purchase_order_id,status);
  CREATE INDEX IF NOT EXISTS purchase_receipt_lines_receipt ON purchase_receipt_lines(purchase_receipt_id);
  CREATE INDEX IF NOT EXISTS supplier_returns_receipt ON supplier_returns(purchase_receipt_id);
  CREATE TABLE IF NOT EXISTS purchase_receipt_edit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT NOT NULL UNIQUE,
    purchase_receipt_id INTEGER NOT NULL,
    old_total REAL NOT NULL,
    new_total REAL NOT NULL,
    edited_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE RESTRICT,
    FOREIGN KEY(edited_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  INSERT OR IGNORE INTO document_sequences(document_type,current_value)
    VALUES('PURCHASE_ORDER',0),('PURCHASE_RECEIPT',0),('SUPPLIER_RETURN',0);
`);

const supplierColumns = new Set(
  db
    .prepare("PRAGMA table_info(suppliers)")
    .all()
    .map((column) => column.name),
);
for (const column of [
  "nif",
  "nis",
  "tax_article",
  "commercial_register",
  "business_activity",
]) {
  if (!supplierColumns.has(column))
    db.exec(`ALTER TABLE suppliers ADD COLUMN ${column} TEXT`);
}

const supplierReturnColumns = new Set(
  db
    .prepare("PRAGMA table_info(supplier_returns)")
    .all()
    .map((column) => column.name),
);
// Older installations used invoice/payment links and an INVOICE_DEBT check.
// CREATE TABLE IF NOT EXISTS cannot update either the columns or that CHECK,
// so normalize the legacy ledger once while preserving its history.
const supplierAccountColumns = new Set(
  db.prepare("PRAGMA table_info(supplier_account_entries)").all().map((column) => column.name),
);
const supplierAccountSql = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='supplier_account_entries'",
).get()?.sql || "";
if (
  !supplierAccountColumns.has("purchase_receipt_id") ||
  !supplierAccountColumns.has("financial_transaction_id") ||
  !supplierAccountSql.includes("RECEIPT_DEBT") ||
  supplierAccountColumns.has("supplier_invoice_id") ||
  supplierAccountColumns.has("supplier_payment_id")
) {
  const foreignKeysEnabled = Number(db.pragma("foreign_keys", { simple: true })) === 1;
  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    db.exec("DROP TABLE IF EXISTS supplier_account_entries_legacy");
    db.exec("ALTER TABLE supplier_account_entries RENAME TO supplier_account_entries_legacy");
    db.exec(`CREATE TABLE supplier_account_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      purchase_receipt_id INTEGER,
      supplier_return_id INTEGER,
      financial_transaction_id INTEGER,
      entry_type TEXT NOT NULL CHECK(entry_type IN ('RECEIPT_DEBT','PAYMENT','RETURN_CREDIT','ADJUSTMENT')),
      amount REAL NOT NULL CHECK(amount<>0),
      reference TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
      FOREIGN KEY(purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE RESTRICT,
      FOREIGN KEY(supplier_return_id) REFERENCES supplier_returns(id) ON DELETE RESTRICT,
      FOREIGN KEY(financial_transaction_id) REFERENCES financial_transactions(id) ON DELETE RESTRICT,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
    )`);
    const oldColumns = new Set(
      db.prepare("PRAGMA table_info(supplier_account_entries_legacy)").all().map((column) => column.name),
    );
    const old = (name) => oldColumns.has(name) ? name : "NULL";
    db.exec(`INSERT INTO supplier_account_entries(
      id,supplier_id,purchase_receipt_id,supplier_return_id,financial_transaction_id,
      entry_type,amount,reference,created_by,created_at
    ) SELECT
      id,supplier_id,${old("purchase_receipt_id")},${old("supplier_return_id")},${old("financial_transaction_id")},
      CASE entry_type WHEN 'INVOICE_DEBT' THEN 'RECEIPT_DEBT' ELSE entry_type END,
      amount,reference,created_by,created_at
    FROM supplier_account_entries_legacy
    WHERE amount<>0 AND entry_type IN ('INVOICE_DEBT','RECEIPT_DEBT','PAYMENT','RETURN_CREDIT','ADJUSTMENT')`);
    db.exec("DROP TABLE supplier_account_entries_legacy");
  })();
  if (foreignKeysEnabled) db.pragma("foreign_keys = ON");
}
if (supplierReturnColumns.has("supplier_invoice_id")) {
  const foreignKeysEnabled = Number(db.pragma("foreign_keys", { simple: true })) === 1;
  db.pragma("foreign_keys = OFF");
  db.pragma("legacy_alter_table = ON");
  db.transaction(() => {
    db.exec("DROP TABLE IF EXISTS supplier_returns_legacy");
    db.exec("ALTER TABLE supplier_returns RENAME TO supplier_returns_legacy");
    db.exec(`CREATE TABLE supplier_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_request_id TEXT UNIQUE,
      return_number TEXT NOT NULL UNIQUE,
      purchase_receipt_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      return_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'VALIDATED' CHECK(status IN ('VALIDATED','CANCELLED')),
      total REAL NOT NULL DEFAULT 0 CHECK(total>=0),
      note TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      settlement_mode TEXT NOT NULL DEFAULT 'SUPPLIER_CREDIT',
      refund_amount REAL NOT NULL DEFAULT 0,
      refund_payment_method_code TEXT,
      cash_session_id INTEGER,
      FOREIGN KEY(purchase_receipt_id) REFERENCES purchase_receipts(id) ON DELETE RESTRICT,
      FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
    )`);
    db.exec(`INSERT INTO supplier_returns(
      id,client_request_id,return_number,purchase_receipt_id,warehouse_id,supplier_id,
      return_date,status,total,note,created_by,created_at,settlement_mode,refund_amount,
      refund_payment_method_code,cash_session_id
    ) SELECT
      id,client_request_id,return_number,purchase_receipt_id,warehouse_id,supplier_id,
      return_date,status,total,note,created_by,created_at,
      COALESCE(settlement_mode,'SUPPLIER_CREDIT'),COALESCE(refund_amount,0),
      refund_payment_method_code,cash_session_id
    FROM supplier_returns_legacy`);
    db.exec("DROP TABLE supplier_returns_legacy");
  })();
  db.pragma("legacy_alter_table = OFF");
  if (foreignKeysEnabled) db.pragma("foreign_keys = ON");
}
if (!db.prepare("SELECT 1 FROM schema_migrations WHERE id='remove-supplier-invoice-payment-tables-v2'").get()) {
  const foreignKeysEnabled = Number(db.pragma("foreign_keys", { simple: true })) === 1;
  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS supplier_payment_allocations;
      DROP TABLE IF EXISTS supplier_credit_allocations;
      DROP TABLE IF EXISTS supplier_invoice_receipt_allocations;
      DROP TABLE IF EXISTS supplier_refunds;
      DROP TABLE IF EXISTS supplier_credits;
      DROP TABLE IF EXISTS supplier_payments;
      DROP TABLE IF EXISTS supplier_invoice_lines;
      DROP TABLE IF EXISTS supplier_invoices;
      DROP TABLE IF EXISTS purchase_payments;
      DROP TABLE IF EXISTS purchase_invoices;
    `);
    db.prepare("INSERT INTO schema_migrations(id) VALUES(?)").run("remove-supplier-invoice-payment-tables-v2");
  })();
  if (foreignKeysEnabled) db.pragma("foreign_keys = ON");
}
if (!supplierReturnColumns.has("settlement_mode"))
  db.exec(
    "ALTER TABLE supplier_returns ADD COLUMN settlement_mode TEXT NOT NULL DEFAULT 'SUPPLIER_CREDIT'",
  );
if (!supplierReturnColumns.has("refund_amount"))
  db.exec(
    "ALTER TABLE supplier_returns ADD COLUMN refund_amount REAL NOT NULL DEFAULT 0",
  );
if (!supplierReturnColumns.has("refund_payment_method_code"))
  db.exec(
    "ALTER TABLE supplier_returns ADD COLUMN refund_payment_method_code TEXT",
  );
if (!supplierReturnColumns.has("cash_session_id"))
  db.exec("ALTER TABLE supplier_returns ADD COLUMN cash_session_id INTEGER");

const insertPurchasePrintProfile = db.prepare(
  "INSERT OR IGNORE INTO print_profiles(document_type,paper_format,configuration_json) VALUES(?,?,?)",
);
insertPurchasePrintProfile.run(
  "PURCHASE_ORDER",
  "A4",
  JSON.stringify({
    title: "BON DE COMMANDE",
    show_logo: true,
    show_legal_info: true,
    show_product_reference: true,
    show_discounts: false,
  }),
);
insertPurchasePrintProfile.run(
  "PURCHASE_RECEIPT",
  "A4",
  JSON.stringify({
    title: "BON DE RÉCEPTION",
    show_logo: true,
    show_legal_info: true,
    show_product_reference: true,
    show_discounts: false,
  }),
);
insertPurchasePrintProfile.run(
  "PURCHASE_RETURN",
  "A4",
  JSON.stringify({
    title: "BON DE RETOUR FOURNISSEUR",
    show_logo: true,
    show_warehouse_name: true,
    show_address: true,
    show_phone: true,
    show_email: true,
    show_legal_info: true,
    show_customer: true,
    show_product_reference: true,
    show_discounts: false,
  }),
);

module.exports = true;
