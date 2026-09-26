/* eslint-disable no-console */
const db = require("../config/database");
require("./migrations/init");

const businessTables = [
  "products",
  "customers",
  "suppliers",
  "sales",
  "quotes",
  "invoices",
  "purchase_orders",
  "purchase_receipts",
  "financial_transactions",
  "cash_movements",
  "stock_movements",
];
for (const table of businessTables) {
  const exists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(table);
  if (!exists) continue;
  const count = Number(db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count);
  if (count !== 0) throw new Error(`Clean install contains ${count} row(s) in ${table}`);
}

const users = db.prepare("SELECT username,role,is_active FROM users").all();
if (
  users.length !== 1 ||
  users[0].username !== "admin" ||
  users[0].role !== "admin" ||
  !users[0].is_active
)
  throw new Error("Clean install must contain exactly one active administrator");

console.log("Clean installation database verified.");
db.close();
