const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "moderna-ledger-migration-test-"));
process.env.POS_TEST_DB_PATH = path.join(directory, "legacy.db");
const legacy = new Database(process.env.POS_TEST_DB_PATH);
legacy.exec(`
  CREATE TABLE schema_migrations(id TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);
  INSERT INTO schema_migrations(id) VALUES('remove-legacy-purchases-tva-v1');
  CREATE TABLE supplier_account_entries(
    id INTEGER PRIMARY KEY, supplier_id INTEGER, entry_type TEXT,
    amount REAL, reference TEXT, created_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
legacy.close();

try {
  require("../database/migrations/init");
  const db = require("../config/database");
  const columns = new Set(db.prepare("PRAGMA table_info(supplier_account_entries)").all().map((column) => column.name));
  for (const column of ["purchase_receipt_id", "supplier_return_id", "financial_transaction_id"])
    assert.ok(columns.has(column), `${column} must be added to legacy ledgers`);
  assert.equal(db.pragma("foreign_key_check").length, 0);
  db.close();
  console.log("Legacy supplier ledger migration passed.");
} finally {
  if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith("moderna-ledger-migration-test-"))
    fs.rmSync(directory, { recursive: true, force: true });
}
