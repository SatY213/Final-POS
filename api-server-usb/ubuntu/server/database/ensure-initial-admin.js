const { hashPassword } = require("../utils/password");

const INITIAL_ADMIN_USERNAME = "admin";
const INITIAL_ADMIN_PASSWORD = "admin123";

function ensureInitialAdmin(db) {
  const count = Number(db.prepare("SELECT COUNT(*) count FROM users").get().count);
  if (count > 0) return { created: false, count };
  db.prepare(
    `INSERT INTO users(name,username,password_hash,role,warehouse_id,is_active)
     VALUES(?,?,?,?,NULL,1)`,
  ).run(
    "Administrator",
    INITIAL_ADMIN_USERNAME,
    hashPassword(INITIAL_ADMIN_PASSWORD),
    "admin",
  );
  return { created: true, count: 1 };
}

module.exports = {
  ensureInitialAdmin,
  INITIAL_ADMIN_USERNAME,
  INITIAL_ADMIN_PASSWORD,
};
