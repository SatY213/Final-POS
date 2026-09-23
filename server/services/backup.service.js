const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const db = require("../config/database");
const { scheduleRestore, pendingName, backupDirectory, requiredTables } = require("./pending-restore");

class BackupError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

fs.mkdirSync(backupDirectory, { recursive: true });

function removeSidecars(filePath) {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${filePath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
}

function ensureAdmin(user) {
  if (user?.role !== "admin")
    throw new BackupError("Backup management is restricted to administrators", 403);
}

function safeName(value) {
  const name = path.basename(String(value || ""));
  if (!/^moderna-[a-zA-Z0-9_.-]+\.sqlite$/.test(name))
    throw new BackupError("Backup file name is invalid");
  return name;
}

function inspect(filePath) {
  let source;
  try {
    source = new Database(filePath, { readonly: true, fileMustExist: true });
    const integrity = source.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new BackupError("Backup database integrity check failed", 409);
    const tables = new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
    if (requiredTables.some((table) => !tables.has(table)))
      throw new BackupError("The selected file is not a compatible MODERNA POS backup", 409);
    return {
      valid: true,
      user_version: Number(source.pragma("user_version", { simple: true }) || 0),
      application_id: Number(source.pragma("application_id", { simple: true }) || 0),
    };
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError("The selected backup cannot be opened", 409);
  } finally {
    source?.close();
    removeSidecars(filePath);
  }
}

function describe(name) {
  const filename = safeName(name);
  const filePath = path.join(backupDirectory, filename);
  const stat = fs.statSync(filePath);
  let validation;
  try { validation = inspect(filePath); }
  catch (error) { validation = { valid: false, error: error.message }; }
  return {
    name: filename,
    created_at: stat.birthtime.toISOString(),
    updated_at: stat.mtime.toISOString(),
    size: stat.size,
    ...validation,
  };
}

function list(user) {
  ensureAdmin(user);
  return fs.readdirSync(backupDirectory)
    .filter((name) => /^moderna-[a-zA-Z0-9_.-]+\.sqlite$/.test(name))
    .map(describe)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

async function create(user, prefix = "backup") {
  ensureAdmin(user);
  db.pragma("wal_checkpoint(FULL)");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `moderna-${prefix}-${stamp}.sqlite`;
  const destination = path.join(backupDirectory, name);
  await db.backup(destination);
  inspect(destination);
  return describe(name);
}

function file(name, user) {
  ensureAdmin(user);
  const filename = safeName(name);
  const filePath = path.join(backupDirectory, filename);
  if (!fs.existsSync(filePath)) throw new BackupError("Backup not found", 404);
  return { name: filename, path: filePath };
}

function upload(buffer, originalName, user) {
  ensureAdmin(user);
  if (!Buffer.isBuffer(buffer) || buffer.length < 100)
    throw new BackupError("Backup file is empty or invalid");
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 10);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `moderna-import-${stamp}-${hash}.sqlite`;
  const destination = path.join(backupDirectory, name);
  fs.writeFileSync(destination, buffer, { flag: "wx" });
  try { inspect(destination); }
  catch (error) { fs.unlinkSync(destination); throw error; }
  void originalName;
  return describe(name);
}

function remove(name, user) {
  const target = file(name, user);
  if (pendingName() === target.name) throw new BackupError("A backup scheduled for restoration cannot be deleted", 409);
  fs.unlinkSync(target.path);
  removeSidecars(target.path);
  return { deleted: true, name: target.name };
}

async function restore(name, confirmation, user) {
  ensureAdmin(user);
  if (confirmation !== "RESTAURER")
    throw new BackupError("Type RESTAURER to confirm this destructive operation");
  if (pendingName())
    throw new BackupError("A restore is already scheduled", 409);
  const source = file(name, user);
  inspect(source.path);
  const safety = await create(user, "before-restore");
  scheduleRestore(source.name);
  return {
    restored: false,
    scheduled: true,
    restart_required: true,
    safety_backup: safety.name,
  };
}

module.exports = { BackupError, list, create, file, upload, remove, restore, inspect };
