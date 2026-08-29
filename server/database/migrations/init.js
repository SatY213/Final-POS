const db = require("../../config/database");

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
    tax_rate REAL NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
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

`);

const unitColumns = db.prepare("PRAGMA table_info(units)").all();
if (!unitColumns.some((column) => column.name === "is_builtin")) {
  db.exec("ALTER TABLE units ADD COLUMN is_builtin INTEGER NOT NULL DEFAULT 0");
}
let genericUnit = db.prepare("SELECT id FROM units WHERE name = ? COLLATE NOCASE ORDER BY id LIMIT 1").get("Unit\u00e9");
if (!genericUnit) {
  genericUnit = { id: db.prepare("INSERT INTO units(name, symbol, is_builtin, is_active) VALUES (?, '', 1, 1)").run("Unit\u00e9").lastInsertRowid };
}
db.prepare("UPDATE units SET is_builtin = 1, is_active = 1 WHERE id = ?").run(genericUnit.id);
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS units_one_builtin_generic ON units(is_builtin) WHERE is_builtin = 1");

const productColumns = db.prepare("PRAGMA table_info(products)").all();
for (const [name, definition] of [
  ["track_batches", "INTEGER NOT NULL DEFAULT 0"],
  ["track_expiration", "INTEGER NOT NULL DEFAULT 0"],
  ["track_serials", "INTEGER NOT NULL DEFAULT 0"],
]) {
  if (!productColumns.some((column) => column.name === name)) db.exec(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
}
db.exec(`
  UPDATE products SET track_expiration = has_expiration WHERE has_expiration = 1;
  UPDATE products SET track_batches = 1 WHERE track_expiration = 1;
  INSERT OR IGNORE INTO product_units(product_id, unit_id, conversion_factor, purchase_price, selling_price, is_base, is_active)
    SELECT id, unit_id, 1, purchase_price, selling_price, 1, 1 FROM products WHERE unit_id IS NOT NULL;
`);

const barcodeColumns = db.prepare("PRAGMA table_info(product_barcodes)").all();
if (!barcodeColumns.some((column) => column.name === "product_unit_id")) {
  db.exec("ALTER TABLE product_barcodes ADD COLUMN product_unit_id INTEGER REFERENCES product_units(id) ON DELETE RESTRICT");
}
db.exec(`
  UPDATE product_barcodes SET product_unit_id = (
    SELECT pu.id FROM product_units pu WHERE pu.product_id = product_barcodes.product_id AND pu.is_base = 1
  ) WHERE product_unit_id IS NULL;
  DROP INDEX IF EXISTS product_barcodes_one_primary;
  CREATE UNIQUE INDEX IF NOT EXISTS product_barcodes_one_primary_unit
    ON product_barcodes(product_unit_id) WHERE is_primary = 1;
`);

const expirationColumn = db.prepare("PRAGMA table_info(stock_batches)").all().find((column) => column.name === "expiration_date");
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

const userColumns = db.prepare("PRAGMA table_info(users)").all();
const hasUserColumn = (name) => userColumns.some((column) => column.name === name);

if (!hasUserColumn("name")) {
  db.exec("ALTER TABLE users ADD COLUMN name TEXT");
  if (hasUserColumn("full_name")) {
    db.exec("UPDATE users SET name = COALESCE(full_name, username) WHERE name IS NULL");
  } else {
    db.exec("UPDATE users SET name = username WHERE name IS NULL");
  }
}

if (!hasUserColumn("warehouse_id")) {
  db.exec("ALTER TABLE users ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL");
}

console.log("Database initialized.");
