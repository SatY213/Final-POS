const db = require("../config/database");

const fields = `s.id,s.name,s.phone,s.email,s.nif,s.nis,s.rib,s.tax_article,
  s.commercial_register,s.address,s.business_activity,s.opening_balance,
  s.opening_balance + COALESCE((SELECT SUM(e.amount) FROM supplier_account_entries e WHERE e.supplier_id=s.id),0) current_balance,
  s.is_active,s.created_at,s.updated_at`;

function findPage(filters) {
  const params = {
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
  };
  const conditions = [];
  if (filters.search) {
    conditions.push(
      "(s.name LIKE @search COLLATE NOCASE OR s.phone LIKE @search COLLATE NOCASE OR s.email LIKE @search COLLATE NOCASE OR s.nif LIKE @search COLLATE NOCASE OR s.nis LIKE @search COLLATE NOCASE OR s.rib LIKE @search COLLATE NOCASE OR s.commercial_register LIKE @search COLLATE NOCASE)",
    );
    params.search = `%${filters.search}%`;
  }
  if (filters.status === "active") conditions.push("s.is_active=1");
  if (filters.status === "inactive") conditions.push("s.is_active=0");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countParams = { ...params };
  delete countParams.limit;
  delete countParams.offset;
  const total = Number(
    db
      .prepare(`SELECT COUNT(*) count FROM suppliers s ${where}`)
      .get(countParams).count,
  );
  const suppliers = db
    .prepare(
      `SELECT ${fields} FROM suppliers s ${where} ORDER BY s.name COLLATE NOCASE LIMIT @limit OFFSET @offset`,
    )
    .all(params);
  return {
    suppliers,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}

function accountEntries(id) {
  return db
    .prepare(
      `SELECT e.*,
        COALESCE(pr.receipt_number,r.return_number,e.reference) document_reference,
        SUM(e.amount) OVER (ORDER BY e.created_at,e.id ROWS UNBOUNDED PRECEDING) running_entries
       FROM supplier_account_entries e
       LEFT JOIN purchase_receipts pr ON pr.id=e.purchase_receipt_id
       LEFT JOIN supplier_returns r ON r.id=e.supplier_return_id
       WHERE e.supplier_id=? ORDER BY e.created_at DESC,e.id DESC`,
    )
    .all(id);
}

function findById(id) {
  const supplier = db
    .prepare(`SELECT ${fields} FROM suppliers s WHERE s.id=?`)
    .get(id);
  if (!supplier) return null;
  supplier.account = {
    payable: Math.max(0, Number(supplier.current_balance || 0)),
    available_credit: Math.max(0, -Number(supplier.current_balance || 0)),
  };
  supplier.account_entries = accountEntries(id).map((entry) => ({
    ...entry,
    balance_after:
      Number(supplier.opening_balance || 0) + Number(entry.running_entries || 0),
  }));
  return supplier;
}

function create(data) {
  const result = db
    .prepare(
      "INSERT INTO suppliers(name,phone,email,nif,nis,rib,tax_article,commercial_register,address,business_activity,opening_balance,is_active) VALUES(@name,@phone,@email,@nif,@nis,@rib,@tax_article,@commercial_register,@address,@business_activity,@opening_balance,@is_active)",
    )
    .run({ ...data, is_active: +data.is_active });
  return findById(result.lastInsertRowid);
}

function update(id, data) {
  const result = db
    .prepare(
      "UPDATE suppliers SET name=@name,phone=@phone,email=@email,nif=@nif,nis=@nis,rib=@rib,tax_article=@tax_article,commercial_register=@commercial_register,address=@address,business_activity=@business_activity,opening_balance=@opening_balance,is_active=@is_active,updated_at=CURRENT_TIMESTAMP WHERE id=@id",
    )
    .run({ id, ...data, is_active: +data.is_active });
  return result.changes ? findById(id) : null;
}

function setActive(id, active) {
  const result = db
    .prepare(
      "UPDATE suppliers SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .run(+active, id);
  return result.changes ? findById(id) : null;
}

class SupplierInUseError extends Error {
  constructor(uses) {
    super(
      "Supplier cannot be permanently deleted because it is used by existing documents or account entries",
    );
    this.name = "SupplierInUseError";
    this.uses = uses;
  }
}

const usageDefinitions = [
  ["purchase_orders", "purchase orders"],
  ["purchase_receipts", "purchase receipts"],
  ["supplier_returns", "supplier returns"],
  ["supplier_account_entries", "supplier account entries"],
  ["financial_transactions", "financial transactions"],
];

function tableHasSupplierId(name) {
  const table = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(name);
  return Boolean(
    table &&
      db
        .prepare(`PRAGMA table_info(${name})`)
        .all()
        .some((column) => column.name === "supplier_id"),
  );
}

const remove = db.transaction((id) => {
  const supplier = findById(id);
  if (!supplier) return null;
  const uses = usageDefinitions
    .filter(([table]) => tableHasSupplierId(table))
    .map(([table, label]) => ({
      label,
      count: Number(
        db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE supplier_id=?`).get(id)
          .count,
      ),
    }))
    .filter((item) => item.count > 0);
  if (uses.length || Math.abs(Number(supplier.opening_balance || 0)) > 0.000001)
    throw new SupplierInUseError(
      uses.length ? uses : [{ label: "an opening balance", count: 1 }],
    );
  db.prepare("DELETE FROM suppliers WHERE id=?").run(id);
  return supplier;
});

module.exports = {
  findPage,
  findById,
  create,
  update,
  setActive,
  remove,
  SupplierInUseError,
};
