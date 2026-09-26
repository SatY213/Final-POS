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
  return withWarehouses(db.prepare(`${selectFields} WHERE users.id = ?`).get(id));
}
function findAll() {
  return db.prepare(`${selectFields} ORDER BY users.name ASC`).all().map(withWarehouses);
}
function withWarehouses(user) {
  if (!user) return user;
  user.warehouse_ids = db.prepare("SELECT warehouse_id FROM user_warehouses WHERE user_id=? ORDER BY warehouse_id").all(user.id).map((row) => row.warehouse_id);
  return user;
}
function saveWarehouses(userId, warehouseIds = []) {
  db.prepare("DELETE FROM user_warehouses WHERE user_id=?").run(userId);
  const insert = db.prepare("INSERT INTO user_warehouses(user_id,warehouse_id) VALUES(?,?)");
  warehouseIds.forEach((warehouseId) => insert.run(userId, warehouseId));
}

const create = db.transaction(({
  name,
  username,
  password_hash,
  role,
  warehouse_id,
  is_active, warehouse_ids = [],
}) => {
  const result = db
    .prepare(
      `INSERT INTO users (name, username, password_hash, role, warehouse_id, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(name, username, password_hash, role, warehouse_id, is_active ? 1 : 0);
  saveWarehouses(result.lastInsertRowid, warehouse_ids);
  return findById(result.lastInsertRowid);
});

const update = db.transaction((
  id,
  { name, username, password_hash, role, warehouse_id, warehouse_ids = [], is_active },
) => {
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
  if (result.changes) saveWarehouses(id, warehouse_ids);
  return result.changes ? findById(id) : null;
});

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
