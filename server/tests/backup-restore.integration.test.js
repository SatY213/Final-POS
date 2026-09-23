const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

// Never run a restore test against the application's real database.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "moderna-restore-test-"));
process.env.POS_TEST_DB_PATH = path.join(directory, "pos-modern.db");
process.env.POS_TEST_BACKUP_DIR = path.join(directory, "backups");
const db = require("../config/database");
const Backups = require("../services/backup.service");
const Pending = require("../services/pending-restore");

(async () => {
  const admin = { id: 1, role: "admin" };
  for (const table of Pending.requiredTables) db.exec(`CREATE TABLE ${table}(id INTEGER PRIMARY KEY)`);
  db.exec("CREATE TABLE restore_marker(value TEXT)");
  db.prepare("INSERT INTO restore_marker(value) VALUES (?)").run("original");

  assert.throws(() => Backups.list({ id: 2, role: "manager" }), /administrators/);
  const backup = await Backups.create(admin, "integration-test");
  assert.equal(backup.valid, true);
  db.prepare("UPDATE restore_marker SET value=?").run("mutated");

  const result = await Backups.restore(backup.name, "RESTAURER", admin);
  assert.equal(result.restored, false);
  assert.equal(result.scheduled, true);
  assert.equal(result.restart_required, true);
  assert.equal(db.prepare("SELECT value FROM restore_marker").get().value, "mutated", "The live connection must remain usable until restart");
  assert.throws(() => Backups.remove(backup.name, admin), /scheduled for restoration/);
  await assert.rejects(Backups.restore(backup.name, "RESTAURER", admin), /already scheduled/);

  db.close();
  assert.equal(Pending.applyPendingRestore(), true);
  const restored = new Database(process.env.POS_TEST_DB_PATH, { readonly: true });
  try {
    assert.equal(restored.pragma("integrity_check", { simple: true }), "ok");
    assert.equal(restored.prepare("SELECT value FROM restore_marker").get().value, "original");
  } finally {
    restored.close();
  }
  assert.equal(Pending.pendingName(), null);
  for (const suffix of ["", "-wal", "-shm"]) {
    const testFile = `${process.env.POS_TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  }
  process.env.POS_BOOTSTRAP_DB = path.join(process.env.POS_TEST_BACKUP_DIR, backup.name);
  assert.equal(Pending.applyPendingRestore(), true, "A new installation must receive its bundled database");
  const bootstrapped = new Database(process.env.POS_TEST_DB_PATH, { readonly: true });
  try { assert.equal(bootstrapped.prepare("SELECT value FROM restore_marker").get().value, "original"); }
  finally { bootstrapped.close(); }
  console.log("Backup restore passed (live connection safe; backup applied before next database open).");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  if (db.open) db.close();
  if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith("moderna-restore-test-"))
    fs.rmSync(directory, { recursive: true, force: true });
});
