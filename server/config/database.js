const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.resolve(process.env.POS_TEST_DB_PATH ||
  (process.env.POS_DATA_DIR ? path.join(process.env.POS_DATA_DIR, "pos-modern.db") : path.join(__dirname, "pos-modern.db")));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

module.exports = db;
