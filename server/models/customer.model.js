const db = require("../config/database");
const Account = require("../services/customer-account.service");

const fields = `c.id,c.name,c.phone,c.email,c.nif,c.nis,c.rib,c.tax_article,
  c.commercial_register,c.address,c.business_activity,c.opening_balance,
  c.opening_balance + COALESCE((SELECT SUM(e.amount) FROM customer_account_entries e WHERE e.customer_id=c.id),0) current_balance,
  c.is_active,c.created_at,c.updated_at`;

function findPage(filters) {
  const params = {
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
  };
  const conditions = [];
  if (filters.search) {
    conditions.push(
      "(c.name LIKE @search COLLATE NOCASE OR c.phone LIKE @search COLLATE NOCASE OR c.email LIKE @search COLLATE NOCASE OR c.nif LIKE @search COLLATE NOCASE OR c.nis LIKE @search COLLATE NOCASE OR c.rib LIKE @search COLLATE NOCASE OR c.commercial_register LIKE @search COLLATE NOCASE)",
    );
    params.search = `%${filters.search}%`;
  }
  if (filters.status === "active") conditions.push("c.is_active=1");
  if (filters.status === "inactive") conditions.push("c.is_active=0");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const customers = db
    .prepare(
      `SELECT ${fields} FROM customers c ${where} ORDER BY c.name COLLATE NOCASE,c.id LIMIT @limit OFFSET @offset`,
    )
    .all(params);
  const countParams = { ...params };
  delete countParams.limit;
  delete countParams.offset;
  const total = db
    .prepare(`SELECT COUNT(*) count FROM customers c ${where}`)
    .get(countParams).count;
  return {
    customers,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}

function findById(id) {
  const customer = db
    .prepare(`SELECT ${fields} FROM customers c WHERE c.id=?`)
    .get(id);
  if (!customer) return null;
  customer.account = Account.summary(customer.id);
  customer.account_entries = Account.entries(customer.id);
  return customer;
}

function create(data) {
  const result = db
    .prepare(
      "INSERT INTO customers(name,phone,email,nif,nis,rib,tax_article,commercial_register,address,business_activity,opening_balance,is_active) VALUES(@name,@phone,@email,@nif,@nis,@rib,@tax_article,@commercial_register,@address,@business_activity,@opening_balance,@is_active)",
    )
    .run({ ...data, is_active: +data.is_active });
  return findById(result.lastInsertRowid);
}

function update(id, data) {
  const result = db
    .prepare(
      "UPDATE customers SET name=@name,phone=@phone,email=@email,nif=@nif,nis=@nis,rib=@rib,tax_article=@tax_article,commercial_register=@commercial_register,address=@address,business_activity=@business_activity,opening_balance=@opening_balance,is_active=@is_active,updated_at=CURRENT_TIMESTAMP WHERE id=@id",
    )
    .run({ id, ...data, is_active: +data.is_active });
  return result.changes ? findById(id) : null;
}

function setActive(id, active) {
  const result = db
    .prepare(
      "UPDATE customers SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .run(+active, id);
  return result.changes ? findById(id) : null;
}

class CustomerInUseError extends Error {
  constructor(uses) {
    super("Customer cannot be permanently deleted because it is used by existing documents or account entries");
    this.name = "CustomerInUseError";
    this.uses = uses;
  }
}

const usageDefinitions = [
  ["sales", "sales"],
  ["quotes", "quotes"],
  ["deliveries", "deliveries"],
  ["sales_returns", "sales returns"],
  ["invoices", "invoices"],
  ["customer_account_entries", "customer account entries"],
];

function tableExists(name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function findUsage(id) {
  return usageDefinitions
    .filter(([table]) => tableExists(table))
    .map(([table, label]) => ({ label, count: Number(db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE customer_id=?`).get(id).count) }))
    .filter((item) => item.count > 0);
}

const remove = db.transaction((id) => {
  const customer = findById(id);
  if (!customer) return null;
  const uses = findUsage(id);
  if (uses.length || Math.abs(Number(customer.opening_balance || 0)) > 0.000001)
    throw new CustomerInUseError(uses.length ? uses : [{ label: "an opening balance", count: 1 }]);

  // This setting is not a foreign key. Clear it atomically so the POS never
  // keeps an id that no longer resolves to a customer.
  db.prepare("UPDATE app_settings SET value=NULL,updated_at=CURRENT_TIMESTAMP WHERE key='sales.default_customer_id' AND CAST(value AS INTEGER)=?").run(id);
  db.prepare("DELETE FROM customers WHERE id=?").run(id);
  return customer;
});

module.exports = { findPage, findById, create, update, setActive, remove, CustomerInUseError };
