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

const warehouses = db
  .prepare("SELECT id,name,can_sell,is_active FROM warehouses ORDER BY id")
  .all();
if (
  warehouses.length !== 1 ||
  warehouses[0].name !== "Entrepôt principal" ||
  !warehouses[0].can_sell ||
  !warehouses[0].is_active
)
  throw new Error("Clean install must contain exactly one active main warehouse");

const cashRegisters = db
  .prepare(
    "SELECT id,warehouse_id,name,code,is_active FROM cash_registers ORDER BY id",
  )
  .all();
if (
  cashRegisters.length !== 1 ||
  Number(cashRegisters[0].warehouse_id) !== Number(warehouses[0].id) ||
  cashRegisters[0].name !== "Caisse principale" ||
  cashRegisters[0].code !== "MAIN" ||
  !cashRegisters[0].is_active
)
  throw new Error("Clean install must contain exactly one active main cash register");

const users = db.prepare("SELECT username,role,is_active FROM users").all();
if (
  users.length !== 1 ||
  users[0].username !== "admin" ||
  users[0].role !== "admin" ||
  !users[0].is_active
)
  throw new Error("Clean install must contain exactly one active administrator");

const admin = db
  .prepare("SELECT id,warehouse_id FROM users WHERE username='admin'")
  .get();
if (Number(admin.warehouse_id) !== Number(warehouses[0].id))
  throw new Error("Initial administrator must use the main warehouse");
if (
  !db
    .prepare(
      "SELECT 1 FROM user_warehouses WHERE user_id=? AND warehouse_id=?",
    )
    .get(admin.id, warehouses[0].id)
)
  throw new Error("Initial administrator must be linked to the main warehouse");

const defaultWarehouse = db
  .prepare("SELECT value FROM app_settings WHERE key='general.default_warehouse_id'")
  .get();
const defaultRegister = db
  .prepare("SELECT value FROM app_settings WHERE key='general.default_cash_register_id'")
  .get();
if (
  Number(defaultWarehouse?.value) !== Number(warehouses[0].id) ||
  Number(defaultRegister?.value) !== Number(cashRegisters[0].id)
)
  throw new Error("Clean install defaults must reference the startup warehouse and register");

console.log("Clean installation database verified.");
db.close();
