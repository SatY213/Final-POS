const db = require("../../config/database");
const isFreshDatabase = !db
  .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'")
  .get();

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier',
  warehouse_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
);
  
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,

  nif TEXT,
  nis TEXT,
  rib TEXT,
  tax_article TEXT,
  commercial_register TEXT,

  address TEXT,
  business_activity TEXT,

  can_sell INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

  CREATE TABLE IF NOT EXISTS cash_registers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (warehouse_id)
      REFERENCES warehouses(id)
      ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS cash_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_register_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    opening_cash REAL NOT NULL CHECK (opening_cash >= 0),
    opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closing_cash REAL,
    closed_at TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CHECK ((status = 'open' AND closing_cash IS NULL AND closed_at IS NULL) OR
           (status = 'closed' AND closing_cash IS NOT NULL AND closed_at IS NOT NULL))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_register
    ON cash_sessions(cash_register_id) WHERE status = 'open';
  CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_user
    ON cash_sessions(user_id) WHERE status = 'open';

  CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_session_id INTEGER NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('MANUAL_CASH_IN', 'MANUAL_CASH_OUT', 'SALE_PAYMENT', 'PURCHASE_PAYMENT', 'EXPENSE', 'CUSTOMER_REFUND')),
    amount REAL NOT NULL CHECK (amount > 0),
    reference_type TEXT,
    reference_id INTEGER,
    note TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE INDEX IF NOT EXISTS cash_movements_session_date ON cash_movements(cash_session_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    designation TEXT NOT NULL,
    reference TEXT,
    category_id INTEGER,
    unit_id INTEGER,
    purchase_price REAL NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
    selling_price REAL NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    min_stock REAL NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    track_stock INTEGER NOT NULL DEFAULT 1,
    track_batches INTEGER NOT NULL DEFAULT 0,
    track_expiration INTEGER NOT NULL DEFAULT 0,
    track_serials INTEGER NOT NULL DEFAULT 0,
    has_expiration INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT,
    CHECK (has_expiration = 0 OR track_stock = 1)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS products_reference_unique
    ON products(reference COLLATE NOCASE)
    WHERE reference IS NOT NULL AND reference <> '';

  CREATE TABLE IF NOT EXISTS product_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    unit_id INTEGER NOT NULL,
    conversion_factor REAL NOT NULL CHECK (conversion_factor > 0),
    purchase_price REAL NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
    selling_price REAL NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    is_base INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT,
    UNIQUE (product_id, unit_id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS product_units_one_base
    ON product_units(product_id) WHERE is_base = 1;

  CREATE TABLE IF NOT EXISTS product_barcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    product_unit_id INTEGER,
    barcode TEXT NOT NULL UNIQUE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (product_unit_id) REFERENCES product_units(id) ON DELETE RESTRICT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS product_barcodes_one_primary
    ON product_barcodes(product_id) WHERE is_primary = 1;

  CREATE TABLE IF NOT EXISTS product_stock (
    product_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (product_id, warehouse_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS stock_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    batch_number TEXT,
    expiration_date TEXT,
    quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    purchase_price REAL CHECK (purchase_price IS NULL OR purchase_price >= 0),
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS stock_serials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    serial_number TEXT NOT NULL COLLATE NOCASE,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','SOLD','TRANSFERRED','DAMAGED','RETURNED')),
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sold_at TEXT,
    updated_at TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    UNIQUE(product_id,serial_number)
  );
  CREATE INDEX IF NOT EXISTS stock_serials_available ON stock_serials(product_id,warehouse_id,status);

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    batch_id INTEGER,
    type TEXT NOT NULL CHECK (type IN ('INITIAL_STOCK','RECEIPT','ADJUSTMENT_IN','ADJUSTMENT_OUT','TRANSFER_IN','TRANSFER_OUT','PURCHASE','SALE','CUSTOMER_RETURN','SUPPLIER_RETURN','DAMAGE','EXPIRED')),
    quantity REAL NOT NULL CHECK (quantity <> 0),
    reference_type TEXT,
    reference_id TEXT,
    note TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES stock_batches(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS stock_movements_warehouse_date ON stock_movements(warehouse_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS stock_movements_product_date ON stock_movements(product_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    nif TEXT,
    nis TEXT,
    rib TEXT,
    tax_article TEXT,
    commercial_register TEXT,
    address TEXT,
    business_activity TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS suppliers_name_search ON suppliers(name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    nif TEXT,
    nis TEXT,
    rib TEXT,
    tax_article TEXT,
    commercial_register TEXT,
    address TEXT,
    business_activity TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS customers_name_search ON customers(name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY, value TEXT, value_type TEXT NOT NULL DEFAULT 'string' CHECK(value_type IN ('string','number','boolean','json')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by INTEGER,
    FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    affects_cash_drawer INTEGER NOT NULL DEFAULT 0, allows_change INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, system_name TEXT NOT NULL,
    printer_type TEXT NOT NULL CHECK(printer_type IN ('RECEIPT','DOCUMENT','LABEL','GENERIC')),
    workstation_id TEXT, is_default INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS print_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT, document_type TEXT NOT NULL UNIQUE,
    printer_id INTEGER, paper_format TEXT NOT NULL, auto_print INTEGER NOT NULL DEFAULT 0,
    copies INTEGER NOT NULL DEFAULT 1 CHECK(copies BETWEEN 1 AND 10), configuration_json TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT,
    FOREIGN KEY(printer_id) REFERENCES printers(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS document_sequences (
    document_type TEXT PRIMARY KEY, current_value INTEGER NOT NULL DEFAULT 0 CHECK(current_value>=0), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT, client_request_id TEXT UNIQUE, warehouse_id INTEGER NOT NULL,
    cash_register_id INTEGER, cash_session_id INTEGER, customer_id INTEGER, sale_number TEXT UNIQUE,
    fulfillment_type TEXT NOT NULL DEFAULT 'IMMEDIATE' CHECK(fulfillment_type IN ('IMMEDIATE','SHIPPING')),
    sale_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(sale_status IN ('DRAFT','CONFIRMED','CANCELLED')),
    subtotal REAL NOT NULL DEFAULT 0,
    line_discount_total REAL NOT NULL DEFAULT 0, global_discount_percent REAL NOT NULL DEFAULT 0,
    global_discount_type TEXT NOT NULL DEFAULT 'PERCENT' CHECK(global_discount_type IN ('PERCENT','FIXED')),
    global_discount_value REAL NOT NULL DEFAULT 0,
    global_discount_amount REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
    sale_date TEXT NOT NULL DEFAULT (date('now')), note TEXT, customer_reference TEXT, created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(cash_register_id) REFERENCES cash_registers(id) ON DELETE RESTRICT,
    FOREIGN KEY(cash_session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE INDEX IF NOT EXISTS sales_status_user ON sales(sale_status,created_by,created_at DESC);
  CREATE INDEX IF NOT EXISTS sales_warehouse_status_date ON sales(warehouse_id,sale_status,sale_date DESC,id DESC);
  CREATE TABLE IF NOT EXISTS sale_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL,
    line_type TEXT NOT NULL CHECK(line_type IN ('PRODUCT','SERVICE','MISC')), product_id INTEGER, product_unit_id INTEGER,
    designation TEXT NOT NULL, reference TEXT, barcode TEXT, unit_name TEXT NOT NULL,
    conversion_factor REAL NOT NULL CHECK(conversion_factor>0), quantity REAL NOT NULL CHECK(quantity>0), base_quantity REAL,
    unit_price REAL NOT NULL CHECK(unit_price>=0), discount_percent REAL NOT NULL DEFAULT 0,
    discount_type TEXT NOT NULL DEFAULT 'PERCENT' CHECK(discount_type IN ('PERCENT','FIXED')),
    discount_value REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0, subtotal REAL NOT NULL, total REAL NOT NULL,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_unit_id) REFERENCES product_units(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, payment_method_code TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount>0), amount_received REAL, change_amount REAL NOT NULL DEFAULT 0,
    reference TEXT, cash_session_id INTEGER, created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(payment_method_code) REFERENCES payment_methods(code) ON DELETE RESTRICT,
    FOREIGN KEY(cash_session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sale_batch_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_line_id INTEGER NOT NULL, batch_id INTEGER NOT NULL,
    quantity REAL NOT NULL CHECK(quantity>0),
    FOREIGN KEY(sale_line_id) REFERENCES sale_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(batch_id) REFERENCES stock_batches(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sale_serial_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_line_id INTEGER NOT NULL,
    serial_id INTEGER NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sale_line_id) REFERENCES sale_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(serial_id) REFERENCES stock_serials(id) ON DELETE RESTRICT
  );

`);

const seedPayment = db.prepare(
  "INSERT OR IGNORE INTO payment_methods(code,name,affects_cash_drawer,allows_change,is_active,sort_order) VALUES(?,?,?,?,?,?)",
);
[
  ["CASH", "Espèces", 1, 1, 1, 1],
  ["CARD", "Carte", 0, 0, 1, 2],
  ["BANK_TRANSFER", "Virement", 0, 0, 1, 3],
  ["CHEQUE", "Chèque", 0, 0, 1, 4],
].forEach((row) => seedPayment.run(...row));
if (
  db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='financial_transactions'").get()
)
  db.prepare(
    "DELETE FROM financial_transactions WHERE payment_method_code='PURCHASE_RECEIPT' AND source_type IN ('PURCHASE_RECEIPT','PURCHASE_RECEIPT_PAYMENT','SUPPLIER_RETURN_CREDIT')",
  ).run();
db.prepare("DELETE FROM payment_methods WHERE code='PURCHASE_RECEIPT'").run();
db.prepare(
  "UPDATE payment_methods SET is_active=0 WHERE code='CUSTOMER_CREDIT'",
).run();
db.prepare(
  "DELETE FROM app_settings WHERE key='payments.allow_customer_credit'",
).run();
db.prepare(
  "DELETE FROM app_settings WHERE key='payments.allow_split_payment'",
).run();
const seedProfile = db.prepare(
  "INSERT OR IGNORE INTO print_profiles(document_type,paper_format,configuration_json) VALUES(?,?,?)",
);
seedProfile.run(
  "BARCODE_LABEL",
  "50x30mm",
  JSON.stringify({
    symbology: "CODE128",
    show_product_name: true,
    show_price: true,
    show_reference: true,
  }),
);

const unitColumns = db.prepare("PRAGMA table_info(units)").all();
if (!unitColumns.some((column) => column.name === "is_builtin")) {
  db.exec("ALTER TABLE units ADD COLUMN is_builtin INTEGER NOT NULL DEFAULT 0");
}
let genericUnit = db
  .prepare(
    "SELECT id FROM units WHERE is_builtin = 1 OR name = ? COLLATE NOCASE ORDER BY is_builtin DESC, id LIMIT 1",
  )
  .get("Unit\u00e9");
if (!genericUnit) {
  genericUnit = {
    id: db
      .prepare(
        "INSERT INTO units(name, symbol, is_builtin, is_active) VALUES (?, '', 1, 1)",
      )
      .run("Unit\u00e9").lastInsertRowid,
  };
}
db.prepare("UPDATE units SET is_builtin = 1, is_active = 1 WHERE id = ?").run(
  genericUnit.id,
);
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS units_one_builtin_generic ON units(is_builtin) WHERE is_builtin = 1",
);

const productColumns = db.prepare("PRAGMA table_info(products)").all();
for (const [name, definition] of [
  ["track_batches", "INTEGER NOT NULL DEFAULT 0"],
  ["track_expiration", "INTEGER NOT NULL DEFAULT 0"],
  ["track_serials", "INTEGER NOT NULL DEFAULT 0"],
]) {
  if (!productColumns.some((column) => column.name === name))
    db.exec(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
}
db.exec(`
  UPDATE products SET track_expiration = has_expiration WHERE has_expiration = 1;
  UPDATE products SET track_batches = 1 WHERE track_expiration = 1;
  INSERT OR IGNORE INTO product_units(product_id, unit_id, conversion_factor, purchase_price, selling_price, is_base, is_active)
    SELECT id, unit_id, 1, purchase_price, selling_price, 1, 1 FROM products WHERE unit_id IS NOT NULL;
`);

const barcodeColumns = db.prepare("PRAGMA table_info(product_barcodes)").all();
if (!barcodeColumns.some((column) => column.name === "product_unit_id")) {
  db.exec(
    "ALTER TABLE product_barcodes ADD COLUMN product_unit_id INTEGER REFERENCES product_units(id) ON DELETE RESTRICT",
  );
}
db.exec(`
  UPDATE product_barcodes SET product_unit_id = (
    SELECT pu.id FROM product_units pu WHERE pu.product_id = product_barcodes.product_id AND pu.is_base = 1
  ) WHERE product_unit_id IS NULL;
  DROP INDEX IF EXISTS product_barcodes_one_primary;
  CREATE UNIQUE INDEX IF NOT EXISTS product_barcodes_one_primary_unit
    ON product_barcodes(product_unit_id) WHERE is_primary = 1;
`);

const expirationColumn = db
  .prepare("PRAGMA table_info(stock_batches)")
  .all()
  .find((column) => column.name === "expiration_date");
if (expirationColumn?.notnull) {
  db.exec(`
    ALTER TABLE stock_batches RENAME TO stock_batches_legacy;
    CREATE TABLE stock_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, warehouse_id INTEGER NOT NULL,
      batch_number TEXT, expiration_date TEXT, quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      purchase_price REAL CHECK (purchase_price IS NULL OR purchase_price >= 0), received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
    );
    INSERT INTO stock_batches SELECT * FROM stock_batches_legacy;
    DROP TABLE stock_batches_legacy;
  `);
}

const cashSessionColumns = db.prepare("PRAGMA table_info(cash_sessions)").all();
for (const [name, definition] of [
  ["expected_cash_at_close", "REAL"],
  ["closing_difference", "REAL"],
  ["closing_note", "TEXT"],
]) {
  if (!cashSessionColumns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE cash_sessions ADD COLUMN ${name} ${definition}`);
  }
}

const ensureColumns = (table, columns) => {
  const existing = new Set(
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => column.name),
  );
  for (const [name, definition] of columns)
    if (!existing.has(name))
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
};
ensureColumns("products", [["image_data", "TEXT"]]);
ensureColumns("sales", [
  ["sale_date", "TEXT"],
  ["updated_at", "TEXT"],
  ["customer_reference", "TEXT"],
  ["global_discount_type", "TEXT NOT NULL DEFAULT 'PERCENT'"],
  ["global_discount_value", "REAL NOT NULL DEFAULT 0"],
  ["payment_status", "TEXT NOT NULL DEFAULT 'UNPAID'"],
  ["return_status", "TEXT NOT NULL DEFAULT 'NOT_RETURNED'"],
  ["source_quote_id", "INTEGER REFERENCES quotes(id) ON DELETE RESTRICT"],
]);
ensureColumns("sale_lines", [
  ["discount_type", "TEXT NOT NULL DEFAULT 'PERCENT'"],
  ["discount_value", "REAL NOT NULL DEFAULT 0"],
]);

db.exec(
  "UPDATE sales SET sale_date=date(created_at) WHERE sale_date IS NULL; UPDATE sales SET global_discount_value=global_discount_percent WHERE global_discount_value=0 AND global_discount_percent<>0; UPDATE sale_lines SET discount_value=discount_percent WHERE discount_value=0 AND discount_percent<>0;",
);

// Advanced commercial documents are deliberately independent from the sale's
// printable format. Existing completed sales are physical retail fulfillments;
// no synthetic delivery notes or invoices are created for them.
db.exec(`
  CREATE TABLE IF NOT EXISTS customer_account_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('SALE_CREDIT','CUSTOMER_PAYMENT','CREDIT_USAGE','ADJUSTMENT')),
    amount REAL NOT NULL CHECK(amount <> 0),
    sale_id INTEGER,
    payment_id INTEGER,
    reference TEXT,
    description TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(payment_id) REFERENCES sale_payments(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE INDEX IF NOT EXISTS customer_account_customer_date
    ON customer_account_entries(customer_id,created_at DESC,id DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS customer_account_sale_credit_once
    ON customer_account_entries(sale_id) WHERE entry_type='SALE_CREDIT';
  CREATE UNIQUE INDEX IF NOT EXISTS customer_account_credit_usage_once
    ON customer_account_entries(sale_id) WHERE entry_type='CREDIT_USAGE';
  CREATE UNIQUE INDEX IF NOT EXISTS customer_account_payment_once
    ON customer_account_entries(payment_id) WHERE entry_type='CUSTOMER_PAYMENT';

  INSERT OR IGNORE INTO customer_account_entries(
    customer_id,entry_type,amount,sale_id,reference,description,created_by,created_at
  )
  SELECT s.customer_id,'SALE_CREDIT',
    MIN(s.total,COALESCE(SUM(sp.amount),0)),s.id,s.sale_number,
    'Migration ancien crédit client',s.created_by,COALESCE(s.completed_at,s.created_at)
  FROM sales s
  JOIN sale_payments sp ON sp.sale_id=s.id AND sp.payment_method_code='CUSTOMER_CREDIT'
  WHERE s.customer_id IS NOT NULL
  GROUP BY s.id
  HAVING MIN(s.total,COALESCE(SUM(sp.amount),0))>0;

  DELETE FROM sale_payments WHERE payment_method_code='CUSTOMER_CREDIT';

  INSERT OR IGNORE INTO customer_account_entries(
    customer_id,entry_type,amount,sale_id,reference,description,created_by,created_at
  )
  SELECT s.customer_id,'SALE_CREDIT',
    s.total-COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id=s.id),0),
    s.id,s.sale_number,'Solde historique de vente',s.created_by,COALESCE(s.completed_at,s.created_at)
  FROM sales s JOIN customers c ON c.id=s.customer_id
  WHERE s.sale_status='CONFIRMED'
    AND c.name<>'Client comptoir' COLLATE NOCASE
    AND s.total-COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id=s.id),0)>0.001;

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT UNIQUE,
    quote_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    quote_date TEXT NOT NULL,
    valid_until TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    line_discount_total REAL NOT NULL DEFAULT 0,
    global_discount_type TEXT NOT NULL DEFAULT 'PERCENT',
    global_discount_value REAL NOT NULL DEFAULT 0,
    global_discount_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','CONVERTED','CANCELLED')),
    note TEXT,
    customer_reference TEXT,
    converted_sale_id INTEGER,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(converted_sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS quote_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    line_type TEXT NOT NULL,
    product_id INTEGER,
    product_unit_id INTEGER,
    designation TEXT NOT NULL,
    reference TEXT,
    barcode TEXT,
    unit_name TEXT NOT NULL,
    conversion_factor REAL NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    base_quantity REAL,
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    discount_percent REAL NOT NULL DEFAULT 0,
    discount_type TEXT NOT NULL DEFAULT 'PERCENT',
    discount_value REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY(quote_id) REFERENCES quotes(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_unit_id) REFERENCES product_units(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT UNIQUE,
    return_number TEXT NOT NULL UNIQUE,
    sale_id INTEGER NOT NULL,
    customer_id INTEGER,
    warehouse_id INTEGER NOT NULL,
    return_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'VALIDATED' CHECK(status IN ('DRAFT','VALIDATED','CANCELLED')),
    note TEXT,
    validated_at TEXT,
    validated_by INTEGER,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(validated_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sales_return_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    sale_line_id INTEGER NOT NULL,
    product_id INTEGER,
    designation TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    base_quantity REAL,
    unit_price REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY(return_id) REFERENCES sales_returns(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_line_id) REFERENCES sale_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    UNIQUE(return_id,sale_line_id)
  );
  CREATE INDEX IF NOT EXISTS quotes_customer_date ON quotes(customer_id,quote_date DESC);
  CREATE INDEX IF NOT EXISTS quotes_status_date ON quotes(status,quote_date DESC);
  CREATE INDEX IF NOT EXISTS sale_payments_sale ON sale_payments(sale_id);
  CREATE INDEX IF NOT EXISTS sales_returns_sale ON sales_returns(sale_id);
  CREATE INDEX IF NOT EXISTS sales_commercial_statuses ON sales(payment_status,return_status);
  INSERT OR IGNORE INTO document_sequences(document_type,current_value) VALUES('QUOTE',0),('SALES_RETURN',0);
`);
db.exec(`
  UPDATE sales SET return_status='NOT_RETURNED' WHERE return_status IS NULL OR return_status='';
  UPDATE sales SET payment_status=CASE
    WHEN COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id=sales.id),0)<=0 THEN 'UNPAID'
    WHEN COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id=sales.id),0)+0.001<total THEN 'PARTIALLY_PAID'
    ELSE 'PAID' END;
`);
for (const [type, format] of [
  ["QUOTE", "A4"],
  ["DELIVERY_NOTE", "A4"],
  ["SALES_RETURN", "80mm"],
  ["PURCHASE_ORDER", "A4"],
  ["PURCHASE_RECEIPT", "A4"],
  ["PURCHASE_RETURN", "A4"],
]) {
  seedProfile.run(
    type,
    format,
    JSON.stringify({
      show_logo: true,
      show_legal_info: true,
      show_product_reference: true,
      footer_message: "",
    }),
  );
}

const productStockSql =
  db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='product_stock'",
    )
    .get()?.sql || "";
if (/CHECK\s*\(quantity\s*>=\s*0\)/i.test(productStockSql)) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    ALTER TABLE product_stock RENAME TO product_stock_nonnegative;
    CREATE TABLE product_stock (
      product_id INTEGER NOT NULL, warehouse_id INTEGER NOT NULL, quantity REAL NOT NULL DEFAULT 0,
      PRIMARY KEY(product_id,warehouse_id),
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
      FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
    );
    INSERT INTO product_stock SELECT * FROM product_stock_nonnegative;
    DROP TABLE product_stock_nonnegative;
  `);
  db.pragma("foreign_keys = ON");
}

const userColumns = db.prepare("PRAGMA table_info(users)").all();
const hasUserColumn = (name) =>
  userColumns.some((column) => column.name === name);

if (!hasUserColumn("name")) {
  db.exec("ALTER TABLE users ADD COLUMN name TEXT");
  if (hasUserColumn("full_name")) {
    db.exec(
      "UPDATE users SET name = COALESCE(full_name, username) WHERE name IS NULL",
    );
  } else {
    db.exec("UPDATE users SET name = username WHERE name IS NULL");
  }
}

if (!hasUserColumn("warehouse_id")) {
  db.exec(
    "ALTER TABLE users ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL",
  );
}

// Final sales model: a SALE is commercial, a DELIVERY is logistical and
// printable documents never create their own commercial records.
const legacySalesColumns = new Set(
  db
    .prepare("PRAGMA table_info(sales)")
    .all()
    .map((column) => column.name),
);
if (
  legacySalesColumns.has("status") &&
  !legacySalesColumns.has("sale_status")
) {
  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    // Development sales are disposable, but inventory is not: compensate the
    // net effect of old sales/returns before removing their movements.
    const inventoryEffects = db
      .prepare(
        `
      SELECT product_id,warehouse_id,COALESCE(SUM(quantity),0) quantity
      FROM stock_movements
      WHERE reference_type IN ('SALE','DELIVERY_NOTE','SALES_RETURN')
      GROUP BY product_id,warehouse_id
    `,
      )
      .all();
    const restoreStock = db.prepare(`
      INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,?)
      ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=quantity+excluded.quantity
    `);
    inventoryEffects.forEach((row) =>
      restoreStock.run(row.product_id, row.warehouse_id, -Number(row.quantity)),
    );
    db.exec(`
      UPDATE stock_serials SET status='AVAILABLE',sold_at=NULL,updated_at=CURRENT_TIMESTAMP
      WHERE id IN (SELECT serial_id FROM sale_serial_allocations);
      UPDATE quotes SET converted_sale_id=NULL,status=CASE WHEN status='CONVERTED' THEN 'ACCEPTED' ELSE status END;
      DELETE FROM stock_movements WHERE reference_type IN ('SALE','DELIVERY_NOTE','SALES_RETURN');
      DELETE FROM cash_movements WHERE reference_type='SALE';
      DROP TABLE IF EXISTS delivery_batch_allocations;
      DROP TABLE IF EXISTS delivery_note_lines;
      DROP TABLE IF EXISTS delivery_notes;
      DROP TABLE IF EXISTS sales_invoice_lines;
      DROP TABLE IF EXISTS sales_invoices;
      DROP TABLE IF EXISTS sales_return_lines;
      DROP TABLE IF EXISTS sales_returns;
      DROP TABLE IF EXISTS sale_serial_allocations;
      DROP TABLE IF EXISTS sale_batch_allocations;
      DROP TABLE IF EXISTS sale_payments;
      DROP TABLE IF EXISTS sale_lines;
      DROP TABLE IF EXISTS sales;
    `);
  })();
  db.pragma("foreign_keys = ON");
}

db.pragma("foreign_keys = OFF");
db.exec(`
  DROP TABLE IF EXISTS delivery_batch_allocations;
  DROP TABLE IF EXISTS delivery_note_lines;
  DROP TABLE IF EXISTS delivery_notes;
  DROP TABLE IF EXISTS sales_invoice_lines;
  DROP TABLE IF EXISTS sales_invoices;
`);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT NOT NULL UNIQUE,
    warehouse_id INTEGER NOT NULL,
    cash_register_id INTEGER,
    cash_session_id INTEGER,
    customer_id INTEGER,
    sale_number TEXT UNIQUE,
    fulfillment_type TEXT NOT NULL CHECK(fulfillment_type IN ('IMMEDIATE','SHIPPING')),
    sale_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(sale_status IN ('DRAFT','CONFIRMED','CANCELLED')),
    subtotal REAL NOT NULL DEFAULT 0,
    line_discount_total REAL NOT NULL DEFAULT 0,
    global_discount_percent REAL NOT NULL DEFAULT 0,
    global_discount_type TEXT NOT NULL DEFAULT 'PERCENT' CHECK(global_discount_type IN ('PERCENT','FIXED')),
    global_discount_value REAL NOT NULL DEFAULT 0,
    global_discount_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID','PARTIALLY_PAID','PAID')),
    return_status TEXT NOT NULL DEFAULT 'NOT_RETURNED',
    source_quote_id INTEGER,
    sale_date TEXT NOT NULL DEFAULT (date('now')),
    note TEXT,
    customer_reference TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    completed_at TEXT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(cash_register_id) REFERENCES cash_registers(id) ON DELETE RESTRICT,
    FOREIGN KEY(cash_session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(source_quote_id) REFERENCES quotes(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sale_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL,
    line_type TEXT NOT NULL CHECK(line_type IN ('PRODUCT','SERVICE','MISC')), product_id INTEGER, product_unit_id INTEGER,
    designation TEXT NOT NULL, reference TEXT, barcode TEXT, unit_name TEXT NOT NULL,
    conversion_factor REAL NOT NULL CHECK(conversion_factor>0), quantity REAL NOT NULL CHECK(quantity>0), base_quantity REAL,
    unit_price REAL NOT NULL CHECK(unit_price>=0), discount_percent REAL NOT NULL DEFAULT 0,
    discount_type TEXT NOT NULL DEFAULT 'PERCENT', discount_value REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0, subtotal REAL NOT NULL, total REAL NOT NULL,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_unit_id) REFERENCES product_units(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, payment_method_code TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount>0), amount_received REAL, change_amount REAL NOT NULL DEFAULT 0,
    reference TEXT, cash_session_id INTEGER, created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(payment_method_code) REFERENCES payment_methods(code) ON DELETE RESTRICT,
    FOREIGN KEY(cash_session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sale_batch_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_line_id INTEGER NOT NULL, batch_id INTEGER NOT NULL,
    quantity REAL NOT NULL CHECK(quantity>0),
    FOREIGN KEY(sale_line_id) REFERENCES sale_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(batch_id) REFERENCES stock_batches(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sale_serial_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_line_id INTEGER NOT NULL, serial_id INTEGER NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sale_line_id) REFERENCES sale_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(serial_id) REFERENCES stock_serials(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT NOT NULL UNIQUE,
    sale_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    customer_id INTEGER,
    status TEXT NOT NULL DEFAULT 'PREPARED' CHECK(status IN ('PREPARED','SHIPPED','DELIVERED','CANCELLED','RETURNED','FAILED')),
    delivery_date TEXT NOT NULL,
    prepared_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shipped_at TEXT,
    delivered_at TEXT,
    stock_out_at TEXT,
    note TEXT,
    created_by INTEGER NOT NULL,
    updated_at TEXT,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS delivery_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    sale_line_id INTEGER NOT NULL,
    product_id INTEGER,
    designation TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity>0),
    base_quantity REAL,
    FOREIGN KEY(delivery_id) REFERENCES deliveries(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_line_id) REFERENCES sale_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    UNIQUE(delivery_id,sale_line_id)
  );
  CREATE TABLE IF NOT EXISTS sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT, client_request_id TEXT UNIQUE, return_number TEXT NOT NULL UNIQUE,
    sale_id INTEGER NOT NULL, customer_id INTEGER, warehouse_id INTEGER NOT NULL, return_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'VALIDATED', note TEXT, validated_at TEXT, validated_by INTEGER,
    created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(validated_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sales_return_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT, return_id INTEGER NOT NULL, sale_line_id INTEGER NOT NULL,
    product_id INTEGER, designation TEXT NOT NULL, unit_name TEXT NOT NULL, quantity REAL NOT NULL CHECK(quantity>0),
    base_quantity REAL, unit_price REAL NOT NULL, total REAL NOT NULL,
    FOREIGN KEY(return_id) REFERENCES sales_returns(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_line_id) REFERENCES sale_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    UNIQUE(return_id,sale_line_id)
  );
  CREATE INDEX IF NOT EXISTS sales_status_user ON sales(sale_status,created_by,created_at DESC);
  CREATE INDEX IF NOT EXISTS sales_warehouse_status_date ON sales(warehouse_id,sale_status,sale_date DESC,id DESC);
  CREATE INDEX IF NOT EXISTS sales_customer ON sales(customer_id);
  CREATE INDEX IF NOT EXISTS sales_fulfillment_type ON sales(fulfillment_type);
  CREATE INDEX IF NOT EXISTS deliveries_sale ON deliveries(sale_id);
  CREATE INDEX IF NOT EXISTS deliveries_status ON deliveries(status,delivery_date DESC);
  CREATE INDEX IF NOT EXISTS sale_payments_sale ON sale_payments(sale_id);
  CREATE INDEX IF NOT EXISTS sales_returns_sale ON sales_returns(sale_id);
  DELETE FROM print_profiles WHERE document_type IN ('SALE','SALE_RECEIPT','COUNTER_SALE','DELIVERY_NOTE');
  DELETE FROM app_settings WHERE key IN (
    'sales.default_document_type',
    'sales.deliveries_enabled',
    'sales.delivery_status_management',
    'sales.default_delivery_status',
    'sales.default_delivery_document_status',
    'sales.allow_partial_deliveries',
    'sales.invoice_quantity_basis',
    'sales.allow_partial_invoices',
    'sales.allow_partial_payments',
    'sales.allow_sale_without_immediate_payment'
  );
`);
ensureColumns("sales_returns", [["return_total", "REAL NOT NULL DEFAULT 0"]]);
ensureColumns("sales_return_lines", [
  ["historical_unit_total", "REAL NOT NULL DEFAULT 0"],
]);
ensureColumns("sales", [["edited_by", "INTEGER"]]);
ensureColumns("warehouses", [["rib", "TEXT"]]);
ensureColumns("customers", [["rib", "TEXT"]]);
ensureColumns("suppliers", [["rib", "TEXT"]]);
db.exec(`
  CREATE TABLE IF NOT EXISTS warehouse_document_sequences (
    warehouse_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    current_value INTEGER NOT NULL DEFAULT 0 CHECK(current_value>=0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(warehouse_id, document_type),
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
  );
`);
const saleProfileDefaults = {
  show_logo: true,
  show_warehouse_name: true,
  show_address: true,
  show_phone: true,
  show_legal_info: true,
  show_cashier: true,
  show_cash_register: true,
  show_customer: true,
  show_product_reference: false,
  show_payment_details: true,
  show_received_amount: true,
  show_change: true,
  footer_message: "",
};
db.exec(`
  CREATE TABLE IF NOT EXISTS user_warehouses (
    user_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    PRIMARY KEY(user_id, warehouse_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
  );
  INSERT OR IGNORE INTO user_warehouses(user_id,warehouse_id)
    SELECT id,warehouse_id FROM users WHERE warehouse_id IS NOT NULL;
`);
[
  ["SALE_TICKET", "THERMAL_80", "Ticket"],
  ["SALE_INVOICE", "A4", "Bon pour"],
  ["SHIPPING_INVOICE", "A4", "Bon de livraison"],
].forEach(([type, format, title]) =>
  db
    .prepare(
      "INSERT OR IGNORE INTO print_profiles(document_type,paper_format,configuration_json) VALUES(?,?,?)",
    )
    .run(type, format, JSON.stringify({ ...saleProfileDefaults, title })),
);
db.exec(`
  CREATE TABLE IF NOT EXISTS sale_edit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_request_id TEXT NOT NULL UNIQUE,
    sale_id INTEGER NOT NULL,
    old_total REAL NOT NULL,
    new_total REAL NOT NULL,
    edited_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sales_return_serial_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_return_line_id INTEGER NOT NULL,
    serial_id INTEGER NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_return_line_id) REFERENCES sales_return_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY (serial_id) REFERENCES stock_serials(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS sales_return_batch_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_return_line_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    quantity REAL NOT NULL CHECK(quantity>0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_return_line_id) REFERENCES sales_return_lines(id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES stock_batches(id) ON DELETE RESTRICT,
    UNIQUE(sales_return_line_id,batch_id)
  );
`);
db.exec(`
  UPDATE sales_return_lines SET historical_unit_total=CASE WHEN quantity>0 THEN total/quantity ELSE 0 END
  WHERE historical_unit_total=0;
  UPDATE sales_returns SET return_total=COALESCE((SELECT SUM(total) FROM sales_return_lines WHERE return_id=sales_returns.id),0)
  WHERE return_total=0;
`);

require("./remove-purchases-tva");
require("./purchases");
require("./invoices");
require("./transactions");
if (isFreshDatabase && process.env.POS_SKIP_INITIAL_ADMIN !== "1")
  require("../ensure-initial-admin").ensureInitialAdmin(db);
// Legacy builds incremented sales numbers per warehouse although sales.sale_number
// is globally unique.  Bring the global sequence forward before issuing a new
// number so existing documents are never collided with.
db.exec(`
  UPDATE document_sequences
  SET current_value=MAX(current_value,COALESCE((
    SELECT MAX(CAST(substr(sale_number,-6) AS INTEGER)) FROM sales
  ),0))
  WHERE document_type='SALE';
  UPDATE document_sequences
  SET current_value=MAX(current_value,COALESCE((
    SELECT MAX(CAST(substr(return_number,-6) AS INTEGER)) FROM sales_returns
  ),0))
  WHERE document_type='SALES_RETURN';
`);
console.log("Database initialized.");
