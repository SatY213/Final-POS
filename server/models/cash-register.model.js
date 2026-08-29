const db = require("../config/database");

const selectFields = `
  SELECT
    cash_registers.id,
    cash_registers.warehouse_id,
    cash_registers.name,
    cash_registers.code,
    cash_registers.is_active,
    cash_registers.created_at,
    warehouses.name AS warehouse_name
  FROM cash_registers
  JOIN warehouses ON warehouses.id = cash_registers.warehouse_id
`;

function create({ warehouse_id, name, code, is_active = true }) {
  const result = db
    .prepare(
      `INSERT INTO cash_registers (warehouse_id, name, code, is_active)
       VALUES (?, ?, ?, ?)`,
    )
    .run(warehouse_id, name, code, is_active ? 1 : 0);

  return findById(result.lastInsertRowid);
}

function findAll() {
  return db.prepare(`${selectFields} ORDER BY cash_registers.name ASC`).all();
}

function findById(id) {
  return db.prepare(`${selectFields} WHERE cash_registers.id = ?`).get(id);
}

function update(id, { warehouse_id, name, code, is_active }) {
  const result = db
    .prepare(
      `UPDATE cash_registers
       SET warehouse_id = ?, name = ?, code = ?, is_active = ?
       WHERE id = ?`,
    )
    .run(warehouse_id, name, code, is_active ? 1 : 0, id);

  return result.changes ? findById(id) : null;
}

function codeExists(code, excludedId = null) {
  const query = excludedId
    ? "SELECT 1 FROM cash_registers WHERE code = ? COLLATE NOCASE AND id != ?"
    : "SELECT 1 FROM cash_registers WHERE code = ? COLLATE NOCASE";
  return Boolean(
    db.prepare(query).get(...(excludedId ? [code, excludedId] : [code])),
  );
}

function warehouseExists(id) {
  return Boolean(db.prepare("SELECT 1 FROM warehouses WHERE id = ?").get(id));
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  codeExists,
  warehouseExists,
};
