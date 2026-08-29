const db = require("../config/database");

function findAll() {
  return db
    .prepare(
      "SELECT id, name, symbol, is_builtin, is_active, created_at, updated_at FROM units ORDER BY is_builtin DESC, name COLLATE NOCASE",
    )
    .all();
}
function findById(id) {
  return db
    .prepare(
      "SELECT id, name, symbol, is_builtin, is_active, created_at, updated_at FROM units WHERE id = ?",
    )
    .get(id);
}
function duplicateExists(name, symbol, excludedId = null) {
  const sql = excludedId
    ? "SELECT 1 FROM units WHERE (name = ? COLLATE NOCASE OR symbol = ? COLLATE NOCASE) AND id != ?"
    : "SELECT 1 FROM units WHERE name = ? COLLATE NOCASE OR symbol = ? COLLATE NOCASE";
  return Boolean(
    db
      .prepare(sql)
      .get(...(excludedId ? [name, symbol, excludedId] : [name, symbol])),
  );
}
function create(name, symbol) {
  const result = db
    .prepare("INSERT INTO units(name, symbol) VALUES (?, ?)")
    .run(name, symbol);
  return findById(result.lastInsertRowid);
}
function update(id, name, symbol) {
  const result = db
    .prepare(
      "UPDATE units SET name = ?, symbol = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .run(name, symbol, id);
  return result.changes ? findById(id) : null;
}
function setActive(id, isActive) {
  const unit = findById(id);
  if (unit?.is_builtin && !isActive) return null;
  const result = db
    .prepare(
      "UPDATE units SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .run(isActive ? 1 : 0, id);
  return result.changes ? findById(id) : null;
}
function findGeneric() {
  return db.prepare("SELECT id, name, symbol, is_builtin, is_active FROM units WHERE is_builtin = 1 LIMIT 1").get();
}
module.exports = {
  findAll,
  findById,
  duplicateExists,
  create,
  update,
  setActive,
  findGeneric,
};
