"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require(path.resolve(__dirname, "..", "server", "node_modules", "better-sqlite3"));
const { main, parseSqlTuples } = require("./import-to-sqlite");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-modern-legacy-import-"));
const dbPath = path.join(tempDir, "test.sqlite");
const sourceDir = path.join(tempDir, "source");
fs.mkdirSync(sourceDir);

try {
  const parsed = parseSqlTuples("(1, 'N\\'TIC, magasin', 'ligne\\n2', NULL),(2, '15.6'' ecran', 4)");
  assert.deepStrictEqual(parsed, [["1", "N'TIC, magasin", "ligne\n2", null], ["2", "15.6' ecran", "4"]]);

  fs.writeFileSync(path.join(sourceDir, "categories.txt"), "(1, 'Informatique', 0, NULL),(2, '', 0, NULL)");
  fs.writeFileSync(path.join(sourceDir, "clients.txt"), "(10, 'Client, Test', '0', 'Adresse', '0550', '', 'client@test.dz', 'RC1', 'NIF1', 'AI1', -250.50, 0, '2024-01-02', 'NIS1', 0, 0, NULL)");
  fs.writeFileSync(path.join(sourceDir, "suppliers.txt"), "(20, 'Fournisseur Test', 'Oran', '', 'f@test.dz', '0660', 400.25, 0, '2023-02-03', 0, NULL)");
  fs.writeFileSync(path.join(sourceDir, "products.txt"), [
    "(30, 'Ecran 24, IPS', 100, NULL, 'ABC-30', 0, 5, 0, 1, 150, 0, 0, NULL, 0, 0, 0, 0, 0, '', 0, 0, 0, 0)",
    "(31, 'Produit stock negatif', 10, NULL, '', 0, -3, 0, 1, 20, 0, 0, NULL, 0, 0, 0, 0, 0, '', 0, 0, 0, 0)",
  ].join(",\n"));

  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,name TEXT,role TEXT,is_active INTEGER);
    CREATE TABLE warehouses(id INTEGER PRIMARY KEY,name TEXT,is_active INTEGER);
    CREATE TABLE categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,is_active INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT);
    CREATE TABLE units(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,symbol TEXT,is_builtin INTEGER,is_active INTEGER);
    CREATE TABLE products(id INTEGER PRIMARY KEY AUTOINCREMENT,designation TEXT,reference TEXT UNIQUE,category_id INTEGER,unit_id INTEGER,purchase_price REAL,selling_price REAL,min_stock REAL,track_stock INTEGER,is_active INTEGER,updated_at TEXT);
    CREATE TABLE product_units(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER,unit_id INTEGER,conversion_factor REAL,purchase_price REAL,selling_price REAL,is_base INTEGER,is_active INTEGER,UNIQUE(product_id,unit_id));
    CREATE TABLE product_barcodes(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER,product_unit_id INTEGER,barcode TEXT UNIQUE,is_primary INTEGER);
    CREATE TABLE product_stock(product_id INTEGER,warehouse_id INTEGER,quantity REAL,PRIMARY KEY(product_id,warehouse_id));
    CREATE TABLE stock_movements(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER,warehouse_id INTEGER,type TEXT,quantity REAL,reference_type TEXT,reference_id TEXT,note TEXT,created_by INTEGER);
    CREATE TABLE customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,phone TEXT,email TEXT,nif TEXT,nis TEXT,rib TEXT,tax_article TEXT,commercial_register TEXT,address TEXT,business_activity TEXT,opening_balance REAL,is_active INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT);
    CREATE TABLE suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,phone TEXT,email TEXT,nif TEXT,nis TEXT,rib TEXT,tax_article TEXT,commercial_register TEXT,address TEXT,business_activity TEXT,opening_balance REAL,is_active INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT);
    INSERT INTO users VALUES(1,'admin','Admin','admin',1);
    INSERT INTO warehouses VALUES(1,'Principal',1);
    INSERT INTO units(name,symbol,is_builtin,is_active) VALUES('Unite','u',1,1);
  `);
  db.close();

  const args = ["--db", dbPath, "--source-dir", sourceDir, "--warehouse", "1"];
  main(args);
  let check = new Database(dbPath);
  assert.strictEqual(check.prepare("SELECT count(*) total FROM products").get().total, 0, "La simulation ne doit rien ecrire");
  check.close();

  main([...args, "--apply"]);
  main([...args, "--apply"]);
  check = new Database(dbPath);
  assert.strictEqual(check.prepare("SELECT count(*) total FROM categories").get().total, 1);
  assert.strictEqual(check.prepare("SELECT count(*) total FROM customers").get().total, 1);
  assert.strictEqual(check.prepare("SELECT count(*) total FROM suppliers").get().total, 1);
  assert.strictEqual(check.prepare("SELECT count(*) total FROM products").get().total, 2);
  assert.strictEqual(check.prepare("SELECT quantity FROM product_stock WHERE product_id=(SELECT id FROM products WHERE reference='ABC-30')").get().quantity, 0);
  assert.strictEqual(check.prepare("SELECT count(*) total FROM stock_movements").get().total, 0, "L'import ne doit creer aucun mouvement de stock");
  assert.strictEqual(check.prepare("SELECT opening_balance FROM customers").get().opening_balance, -250.5);
  assert.strictEqual(check.prepare("SELECT opening_balance FROM suppliers").get().opening_balance, 400.25);
  check.close();
  console.log("\nTests import legacy SQLite : OK");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
