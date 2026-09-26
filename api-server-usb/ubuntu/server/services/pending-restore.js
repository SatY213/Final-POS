const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const databasePath = path.resolve(
  process.env.POS_TEST_DB_PATH ||
    (process.env.POS_DATA_DIR
      ? path.join(process.env.POS_DATA_DIR, "pos-modern.db")
      : path.join(__dirname, "../config/pos-modern.db")),
);
const backupDirectory = path.resolve(
  process.env.POS_TEST_BACKUP_DIR ||
    (process.env.POS_DATA_DIR
      ? path.join(process.env.POS_DATA_DIR, "backups")
      : path.join(__dirname, "../backups")),
);
const markerPath = path.join(backupDirectory, "pending-restore.json");
const requiredTables = [
  "users",
  "products",
  "sales",
  "financial_transactions",
  "app_settings",
];

function backupName(value) {
  const name = String(value || "");
  if (
    !/^modern-[a-zA-Z0-9_.-]+\.sqlite$/.test(name) ||
    path.basename(name) !== name
  )
    throw new Error("Backup file name is invalid");
  return name;
}

function pendingName() {
  if (!fs.existsSync(markerPath)) return null;
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  return backupName(marker.name);
}

function scheduleRestore(name) {
  const filename = backupName(name);
  fs.mkdirSync(backupDirectory, { recursive: true });
  if (!fs.existsSync(path.join(backupDirectory, filename)))
    throw new Error("Backup not found");
  const temporary = `${markerPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ name: filename }), {
    flag: "wx",
  });
  try {
    fs.renameSync(temporary, markerPath);
  } catch (error) {
    fs.unlinkSync(temporary);
    throw error;
  }
  return filename;
}

function applyPendingRestore() {
  const name = pendingName();
  const bootstrapPath = process.env.POS_BOOTSTRAP_DB;
  if (!name && (fs.existsSync(databasePath) || !bootstrapPath)) return false;
  const sourcePath = name
    ? path.join(backupDirectory, name)
    : path.resolve(bootstrapPath);
  let source;
  try {
    source = new Database(sourcePath, { readonly: true, fileMustExist: true });
    if (source.pragma("integrity_check", { simple: true }) !== "ok")
      throw new Error("Backup database integrity check failed");
    const tables = new Set(
      source
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name),
    );
    if (requiredTables.some((table) => !tables.has(table)))
      throw new Error(
        "The selected file is not a compatible MODERN POS backup",
      );
  } finally {
    source?.close();
  }
  // This runs before any module opens the application database. A failed copy
  // keeps the marker so the server cannot silently start with the wrong data.
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${databasePath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
  fs.copyFileSync(sourcePath, databasePath);
  if (name) fs.unlinkSync(markerPath);
  return true;
}

module.exports = {
  applyPendingRestore,
  scheduleRestore,
  pendingName,
  databasePath,
  backupDirectory,
  requiredTables,
};
