const db = require("../config/database");

function findAll() {
  return db
    .prepare(
      "SELECT id, name, is_active, created_at, updated_at FROM categories ORDER BY name COLLATE NOCASE",
    )
    .all();
}
function findById(id) {
  return db
    .prepare(
      "SELECT id, name, is_active, created_at, updated_at FROM categories WHERE id = ?",
    )
    .get(id);
}
function nameExists(name, excludedId = null) {
  const sql = excludedId
    ? "SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE AND id != ?"
    : "SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE";
  return Boolean(
    db.prepare(sql).get(...(excludedId ? [name, excludedId] : [name])),
  );
}
function create(name) {
  const result = db
    .prepare("INSERT INTO categories(name) VALUES (?)")
    .run(name);
  return findById(result.lastInsertRowid);
}
function update(id, name) {
  const result = db
    .prepare(
      "UPDATE categories SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .run(name, id);
  return result.changes ? findById(id) : null;
}
function setActive(id, isActive) {
  const result = db
    .prepare(
      "UPDATE categories SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .run(isActive ? 1 : 0, id);
  return result.changes ? findById(id) : null;
}
module.exports = { findAll, findById, nameExists, create, update, setActive };
