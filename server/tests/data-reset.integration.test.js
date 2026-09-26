const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "modern-data-reset-"));
process.env.POS_TEST_DB_PATH = path.join(temporary, "reset.sqlite");
process.env.POS_TEST_BACKUP_DIR = path.join(temporary, "backups");

(async () => {
  const db = require("../config/database");
  require("../database/migrations/init");
  const Backups = require("../services/backup.service");
  const warehouseId = Number(
    db.prepare("INSERT INTO warehouses(name) VALUES(?)").run("Reset warehouse")
      .lastInsertRowid,
  );
  const currentUserId = Number(
    db
      .prepare(
        "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'admin',?)",
      )
      .run("kept-admin", "x", "Kept admin", warehouseId).lastInsertRowid,
  );
  const otherUserId = Number(
    db
      .prepare(
        "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'cashier',?)",
      )
      .run("deleted-user", "x", "Deleted user", warehouseId).lastInsertRowid,
  );
  db.prepare(
    "INSERT INTO user_warehouses(user_id,warehouse_id) VALUES(?,?)",
  ).run(currentUserId, warehouseId);
  db.prepare(
    "INSERT INTO user_warehouses(user_id,warehouse_id) VALUES(?,?)",
  ).run(otherUserId, warehouseId);
  db.prepare("INSERT INTO sessions(user_id,token) VALUES(?,?)").run(
    currentUserId,
    "kept-token",
  );
  db.prepare("INSERT INTO sessions(user_id,token) VALUES(?,?)").run(
    otherUserId,
    "deleted-token",
  );
  db.prepare("INSERT INTO customers(name) VALUES(?)").run("Deleted customer");
  db.prepare("INSERT INTO suppliers(name) VALUES(?)").run("Deleted supplier");
  const unitId = db.prepare("SELECT id FROM units WHERE is_builtin=1").get().id;
  db.prepare("INSERT INTO products(designation,unit_id) VALUES(?,?)").run(
    "Deleted product",
    unitId,
  );
  const settingsBefore = db
    .prepare("SELECT COUNT(*) count FROM app_settings")
    .get().count;

  await assert.rejects(
    () =>
      Backups.resetBusinessData(
        "wrong",
        { id: currentUserId, role: "admin" },
        "kept-token",
      ),
    /SUPPRIMER/,
  );
  const result = await Backups.resetBusinessData(
    "SUPPRIMER",
    { id: currentUserId, role: "admin" },
    "kept-token",
  );
  assert.equal(result.kept_user_id, currentUserId);
  assert.ok(
    fs.existsSync(path.join(temporary, "backups", result.safety_backup)),
  );
  assert.deepEqual(db.prepare("SELECT id FROM users").all(), [
    { id: currentUserId },
  ]);
  assert.deepEqual(db.prepare("SELECT token FROM sessions").all(), [
    { token: "kept-token" },
  ]);
  assert.equal(
    db.prepare("SELECT COUNT(*) count FROM products").get().count,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) count FROM customers").get().count,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) count FROM suppliers").get().count,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) count FROM app_settings").get().count,
    settingsBefore,
  );
  assert.equal(db.pragma("foreign_key_check").length, 0);
  db.close();
  fs.rmSync(temporary, { recursive: true, force: true });
  console.log(
    "Data reset integration test passed (safety backup and current user preserved). ",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
