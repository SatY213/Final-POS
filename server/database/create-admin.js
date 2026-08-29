const db = require("../config/database");

const { hashPassword } = require("../utils/password");

const username = "admin";
const password = "admin123";

const passwordHash = hashPassword(password);

const existing = db
  .prepare(
    `
    SELECT id
    FROM users
    WHERE username = ?
  `,
  )
  .get(username);

if (existing) {
  console.log("Admin already exists.");
  process.exit();
}

db.prepare(
  `
  INSERT INTO users (
    username,
    password_hash,
    name,
    role,
    is_active
  )
  VALUES (?, ?, ?, ?, ?)
`,
).run(username, passwordHash, "Administrator", "admin", 1);

console.log("Admin created.");
