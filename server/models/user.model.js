const db = require("../config/database");

const selectFields = `
  SELECT users.id, users.name, users.username,
         users.role, users.warehouse_id, users.is_active, users.created_at,
         warehouses.name AS warehouse_name
  FROM users
  LEFT JOIN warehouses ON warehouses.id = users.warehouse_id
`;

function findByUsername(username) {
  return db
    .prepare(
      `
    SELECT users.id, users.name, users.username, users.password_hash,
           users.role, users.warehouse_id, users.is_active, users.created_at,
           warehouses.name AS warehouse_name
    FROM users
    LEFT JOIN warehouses ON warehouses.id = users.warehouse_id
    WHERE users.username = ? COLLATE NOCASE
  `,
    )
    .get(username);
}
function findById(id) {
  return db.prepare(`${selectFields} WHERE users.id = ?`).get(id);
}
function findAll() {
  return db.prepare(`${selectFields} ORDER BY users.name ASC`).all();
}

function create({
  name,
  username,
  password_hash,
  role,
  warehouse_id,
  is_active,
}) {
  const result = db
    .prepare(
      `INSERT INTO users (name, username, password_hash, role, warehouse_id, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(name, username, password_hash, role, warehouse_id, is_active ? 1 : 0);
  return findById(result.lastInsertRowid);
}

function update(
  id,
  { name, username, password_hash, role, warehouse_id, is_active },
) {
  const passwordSql = password_hash ? ", password_hash = @password_hash" : "";
  const result = db
    .prepare(
      `UPDATE users SET name = @name, username = @username, role = @role, warehouse_id = @warehouse_id, is_active = @is_active ${passwordSql} WHERE id = @id`,
    )
    .run({
      id,
      name,
      username,
      password_hash,
      role,
      warehouse_id,
      is_active: is_active ? 1 : 0,
    });
  return result.changes ? findById(id) : null;
}

function usernameExists(username, excludedId = null) {
  const sql = excludedId
    ? "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE AND id != ?"
    : "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE";
  return Boolean(
    db.prepare(sql).get(...(excludedId ? [username, excludedId] : [username])),
  );
}

module.exports = {
  findByUsername,
  findById,
  findAll,
  create,
  update,
  usernameExists,
};
