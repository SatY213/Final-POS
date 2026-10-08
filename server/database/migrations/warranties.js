"use strict";

const db = require("../../config/database");

db.exec(`
  CREATE TABLE IF NOT EXISTS warranties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warranty_number TEXT NOT NULL UNIQUE,
    warehouse_id INTEGER NOT NULL,
    customer_id INTEGER,
    product_id INTEGER,
    product_unit_id INTEGER,
    sale_id INTEGER,
    invoice_id INTEGER,
    customer_full_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    customer_address TEXT,
    product_nature TEXT NOT NULL,
    product_model TEXT,
    product_brand TEXT,
    serial_number TEXT,
    batch_number TEXT,
    invoiced_price REAL NOT NULL DEFAULT 0 CHECK(invoiced_price >= 0),
    source_type TEXT NOT NULL DEFAULT 'SALE' CHECK(source_type IN ('SALE','INVOICE')),
    source_reference TEXT,
    invoice_reference TEXT,
    sale_date TEXT NOT NULL,
    duration_value INTEGER NOT NULL CHECK(duration_value > 0),
    duration_unit TEXT NOT NULL CHECK(duration_unit IN ('DAYS','MONTHS')),
    warranty_end_date TEXT NOT NULL,
    note TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY(product_unit_id) REFERENCES product_units(id) ON DELETE RESTRICT,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE INDEX IF NOT EXISTS warranties_warehouse_date
    ON warranties(warehouse_id, sale_date DESC, id DESC);
  CREATE INDEX IF NOT EXISTS warranties_customer ON warranties(customer_id);
  CREATE INDEX IF NOT EXISTS warranties_product ON warranties(product_id);
  INSERT OR IGNORE INTO document_sequences(document_type,current_value)
    VALUES('WARRANTY',0);
`);

const columns = new Set(
  db.prepare("PRAGMA table_info(warranties)").all().map((column) => column.name),
);
if (!columns.has("sale_id"))
  db.exec("ALTER TABLE warranties ADD COLUMN sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT");
if (!columns.has("source_type"))
  db.exec("ALTER TABLE warranties ADD COLUMN source_type TEXT NOT NULL DEFAULT 'SALE' CHECK(source_type IN ('SALE','INVOICE'))");
if (!columns.has("source_reference"))
  db.exec("ALTER TABLE warranties ADD COLUMN source_reference TEXT");
db.exec(`
  UPDATE warranties
  SET source_type='INVOICE',source_reference=invoice_reference
  WHERE source_reference IS NULL AND invoice_reference IS NOT NULL;
  CREATE INDEX IF NOT EXISTS warranties_sale ON warranties(sale_id);
  CREATE INDEX IF NOT EXISTS warranties_invoice ON warranties(invoice_id);
`);

db.prepare(
  "INSERT OR IGNORE INTO print_profiles(document_type,paper_format,configuration_json) VALUES('WARRANTY','A4',?)",
).run(
  JSON.stringify({
    title: "Bon de garantie",
    show_logo: true,
    show_warehouse_name: true,
    show_address: true,
    show_phone: true,
    show_email: true,
    show_legal_info: true,
    show_customer: true,
    show_signature_area: true,
    footer_message: "",
  }),
);
