const db = require("../config/database");

const { ensureInitialAdmin } = require("./ensure-initial-admin");

const result = ensureInitialAdmin(db);
console.log(
  result.created
    ? "Admin created."
    : "A user already exists; admin was not recreated.",
);
db.close();
