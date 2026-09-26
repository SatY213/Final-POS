const crypto = require("crypto");
const db = require("../config/database");

function create(userId) {
  const token = crypto.randomBytes(32).toString("hex");

  db.prepare(
    `
    INSERT INTO sessions (
      user_id,
      token
    )
    VALUES (?, ?)
  `,
  ).run(userId, token);

  return token;
}

function findByToken(token) {
  return db
    .prepare(
      `
      SELECT
        sessions.id,
        sessions.token,
        users.id AS user_id,
        users.username,
        users.name,
        users.role,
        users.warehouse_id,
        users.is_active
      FROM sessions
      JOIN users
        ON users.id = sessions.user_id
      WHERE sessions.token = ?
    `,
    )
    .get(token);
}

function remove(token) {
  return db
    .prepare(
      `
      DELETE FROM sessions
      WHERE token = ?
    `,
    )
    .run(token);
}

module.exports = {
  create,
  findByToken,
  remove,
};
