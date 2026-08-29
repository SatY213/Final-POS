const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "pos-modern.db");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

module.exports = db;
