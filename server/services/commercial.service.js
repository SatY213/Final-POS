const db = require("../config/database");
const Settings = require("./settings.service");
const Pos = require("./pos.service");
const SalePayment = require("./sale-payment.service");
const CustomerAccount = require("./customer-account.service");

class CommercialError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const money = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const quantity = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
const today = () => new Date().toISOString().slice(0, 10);
function authorizeWarehouse(warehouseId, user) {
  const id = Number(warehouseId);
  const warehouse = db
    .prepare("SELECT * FROM warehouses WHERE id=? AND is_active=1")
    .get(id);
  if (!warehouse) throw new CommercialError("Warehouse is unavailable", 404);
  if (
    user.role !== "admin" &&
    (user.warehouse_ids?.length
      ? !user.warehouse_ids.map(Number).includes(id)
      : user.warehouse_id != null && Number(user.warehouse_id) !== id)
  )
    throw new CommercialError("Warehouse is unauthorized", 403);
  return warehouse;
}
function requireRole(user, roles) {
  if (!roles.includes(user.role))
    throw new CommercialError(
      "This commercial action is not allowed for your role",
      403,
    );
}
function activeCustomer(id) {
  const customer = db
    .prepare("SELECT * FROM customers WHERE id=? AND is_active=1")
    .get(Number(id));
  if (!customer)
    throw new CommercialError("A valid active customer is required");
  return customer;
}
const paymentSummary = SalePayment.paymentSummary;
const syncPaymentStatus = SalePayment.syncPaymentStatus;
function insertSnapshotLines(table, parentColumn, parentId, lines) {
  const sql = `INSERT INTO ${table}(${parentColumn},line_type,product_id,product_unit_id,designation,reference,barcode,unit_name,conversion_factor,quantity,base_quantity,unit_price,discount_percent,discount_type,discount_value,discount_amount,subtotal,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const insert = db.prepare(sql);
  lines.forEach((line) =>
    insert.run(
      parentId,
      line.line_type,
      line.product_id,
      line.product_unit_id,
      line.designation,
      line.reference,
      line.barcode,
      line.unit_name,
      line.conversion_factor,
      line.quantity,
      line.base_quantity,
      line.unit_price,
      line.discount_percent,
      line.discount_type,
      line.discount_value,
      line.discount_amount,
      line.subtotal,
      line.total,
    ),
  );
}
function hydrateQuote(id) {
  const quote = db
    .prepare(
      `SELECT q.*,c.name customer_name,w.name warehouse_name,u.name created_by_name,s.sale_number converted_sale_number FROM quotes q JOIN customers c ON c.id=q.customer_id JOIN warehouses w ON w.id=q.warehouse_id JOIN users u ON u.id=q.created_by LEFT JOIN sales s ON s.id=q.converted_sale_id WHERE q.id=?`,
    )
    .get(id);
  if (!quote) return null;
  quote.lines = db
    .prepare("SELECT * FROM quote_lines WHERE quote_id=? ORDER BY id")
    .all(id);
  quote.print_profile =
    Settings.profiles().find((p) => p.document_type === "QUOTE") || null;
  return quote;
}
const saveQuote = db.transaction((data, user) => {
  requireRole(user, ["admin", "manager", "cashier"]);
  if (!data.client_request_id)
    throw new CommercialError("Quote request identifier is required");
  const duplicate = db
    .prepare("SELECT id FROM quotes WHERE client_request_id=?")
    .get(data.client_request_id);
  if (duplicate) return hydrateQuote(duplicate.id);
  const warehouse = authorizeWarehouse(data.warehouse_id, user),
    customer = activeCustomer(data.customer_id),
    salesSettings = Settings.getGroup("sales");
  const lines = Pos.calculateLines(data.lines, salesSettings);
  const totals = Pos.totals(
    lines,
    { type: data.global_discount_type, value: data.global_discount_value },
    salesSettings,
  );
  const date = String(data.quote_date || today());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new CommercialError("Quote date is invalid");
  const id = Number(
    db
      .prepare(
        `INSERT INTO quotes(client_request_id,quote_number,customer_id,warehouse_id,quote_date,valid_until,subtotal,line_discount_total,global_discount_type,global_discount_value,global_discount_amount,total,status,note,customer_reference,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'DRAFT',?,?,?)`,
      )
      .run(
        data.client_request_id,
        Settings.nextDocumentNumber("QUOTE", warehouse.id),
        customer.id,
        warehouse.id,
        date,
        data.valid_until || null,
        totals.subtotal,
        totals.line_discount_total,
        totals.global_discount_type,
        totals.global_discount_value,
        totals.global_discount_amount,
        totals.total,
        String(data.note || "").trim() || null,
        String(data.customer_reference || "").trim() || null,
        user.id,
      ).lastInsertRowid,
  );
  insertSnapshotLines("quote_lines", "quote_id", id, lines);
  return hydrateQuote(id);
});
function listQuotes(filters, user) {
  const warehouse = authorizeWarehouse(filters.warehouse_id, user),
    page = Math.max(1, Number(filters.page) || 1),
    limit = [25, 50, 100].includes(Number(filters.limit))
      ? Number(filters.limit)
      : 25,
    params = { warehouse: warehouse.id },
    where = ["q.warehouse_id=@warehouse"];
  if (filters.status) {
    where.push("q.status=@status");
    params.status = filters.status;
  }
  if (filters.search) {
    where.push(
      "(q.quote_number LIKE @search OR c.name LIKE @search OR q.customer_reference LIKE @search)",
    );
    params.search = `%${String(filters.search).trim()}%`;
  }
  if (filters.from) {
    where.push("q.quote_date>=@from");
    params.from = filters.from;
  }
  if (filters.to) {
    where.push("q.quote_date<=@to");
    params.to = filters.to;
  }
  const clause = where.join(" AND "),
    count = db
      .prepare(
        `SELECT COUNT(*) count FROM quotes q JOIN customers c ON c.id=q.customer_id WHERE ${clause}`,
      )
      .get(params).count;
  const items = db
    .prepare(
      `SELECT q.*,c.name customer_name FROM quotes q JOIN customers c ON c.id=q.customer_id WHERE ${clause} ORDER BY q.quote_date DESC,q.id DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset: (page - 1) * limit });
  return {
    items,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.max(1, Math.ceil(count / limit)),
    },
  };
}
function quoteDetail(id, user) {
  const quote = hydrateQuote(id);
  if (!quote) throw new CommercialError("Quote not found", 404);
  authorizeWarehouse(quote.warehouse_id, user);
  return quote;
}
const updateQuote = db.transaction((id, data, user) => {
  const quote = quoteDetail(id, user);
  if (quote.status !== "DRAFT")
    throw new CommercialError("Only a draft quote can be edited", 409);
  const customer = activeCustomer(data.customer_id ?? quote.customer_id),
    settings = Settings.getGroup("sales"),
    lines = Pos.calculateLines(data.lines, settings),
    totals = Pos.totals(
      lines,
      { type: data.global_discount_type, value: data.global_discount_value },
      settings,
    );
  db.prepare("DELETE FROM quote_lines WHERE quote_id=?").run(id);
  db.prepare(
    `UPDATE quotes SET customer_id=?,valid_until=?,subtotal=?,line_discount_total=?,global_discount_type=?,global_discount_value=?,global_discount_amount=?,total=?,note=?,customer_reference=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
  ).run(
    customer.id,
    data.valid_until || null,
    totals.subtotal,
    totals.line_discount_total,
    totals.global_discount_type,
    totals.global_discount_value,
    totals.global_discount_amount,
    totals.total,
    String(data.note || "").trim() || null,
    String(data.customer_reference || "").trim() || null,
    id,
  );
  insertSnapshotLines("quote_lines", "quote_id", id, lines);
  return hydrateQuote(id);
});
function setQuoteStatus(id, status, user) {
  requireRole(user, ["admin", "manager"]);
  const quote = quoteDetail(id, user);
  if (
    !["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CANCELLED"].includes(status) ||
    ["CONVERTED", "CANCELLED"].includes(quote.status)
  )
    throw new CommercialError("Quote status transition is invalid", 409);
  db.prepare(
    "UPDATE quotes SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).run(status, id);
  return hydrateQuote(id);
}

function saleForAction(id, user) {
  const sale = db
    .prepare("SELECT * FROM sales WHERE id=? AND sale_status='CONFIRMED'")
    .get(Number(id));
  if (!sale) throw new CommercialError("Sale not found", 404);
  authorizeWarehouse(sale.warehouse_id, user);
  return sale;
}
function deliveryProgress(saleId) {
  return db
    .prepare(
      `SELECT sl.id sale_line_id,sl.product_id,sl.designation,sl.unit_name,sl.quantity,sl.base_quantity,sl.conversion_factor,COALESCE(SUM(CASE WHEN dn.status='VALIDATED' THEN dnl.quantity ELSE 0 END),0) delivered_quantity FROM sale_lines sl LEFT JOIN delivery_note_lines dnl ON dnl.sale_line_id=sl.id LEFT JOIN delivery_notes dn ON dn.id=dnl.delivery_note_id WHERE sl.sale_id=? GROUP BY sl.id ORDER BY sl.id`,
    )
    .all(saleId)
    .map((r) => ({
      ...r,
      delivered_quantity: quantity(r.delivered_quantity),
      remaining_quantity: Math.max(
        0,
        quantity(r.quantity - r.delivered_quantity),
      ),
    }));
}
function syncDeliveryStatus(saleId) {
  const rows = deliveryProgress(saleId),
    delivered = rows.reduce((s, r) => s + r.delivered_quantity, 0),
    remaining = rows.reduce((s, r) => s + r.remaining_quantity, 0),
    status =
      remaining <= 1e-9
        ? "DELIVERED"
        : delivered > 1e-9
          ? "PARTIALLY_DELIVERED"
          : "PENDING";
  db.prepare("UPDATE sales SET delivery_status=? WHERE id=?").run(
    status,
    saleId,
  );
  return { delivery_status: status, lines: rows };
}
function hydrateDelivery(id) {
  const note = db
    .prepare(
      `SELECT dn.*,s.sale_number,c.name customer_name,w.name warehouse_name,u.name created_by_name,vu.name validated_by_name FROM delivery_notes dn JOIN sales s ON s.id=dn.sale_id JOIN customers c ON c.id=dn.customer_id JOIN warehouses w ON w.id=dn.warehouse_id JOIN users u ON u.id=dn.created_by LEFT JOIN users vu ON vu.id=dn.validated_by WHERE dn.id=?`,
    )
    .get(id);
  if (!note) return null;
  note.lines = db
    .prepare(
      "SELECT * FROM delivery_note_lines WHERE delivery_note_id=? ORDER BY id",
    )
    .all(id);
  note.print_profile =
    Settings.profiles().find((p) => p.document_type === "SALE") || null;
  return note;
}
const createDelivery = db.transaction((saleId, data, user) => {
  requireRole(user, ["admin", "manager", "stock"]);
  const sale = saleForAction(saleId, user);
  if (sale.fulfillment_type !== "SHIPPING")
    throw new CommercialError("This sale does not require delivery", 409);
  if (!sale.customer_id)
    throw new CommercialError("Delivery requires a customer");
  const duplicate =
    data.client_request_id &&
    db
      .prepare("SELECT id FROM delivery_notes WHERE client_request_id=?")
      .get(data.client_request_id);
  if (duplicate) return hydrateDelivery(duplicate.id);
  const remaining = new Map(
      deliveryProgress(sale.id).map((r) => [Number(r.sale_line_id), r]),
    ),
    lines = (data.lines || []).filter((l) => Number(l.quantity) > 0);
  if (!lines.length)
    throw new CommercialError("Add at least one delivery quantity");
  for (const input of lines) {
    const row = remaining.get(Number(input.sale_line_id)),
      qty = quantity(input.quantity);
    if (!row || qty <= 0 || qty - row.remaining_quantity > 1e-9)
      throw new CommercialError(
        "Delivery quantity exceeds the remaining quantity",
        409,
      );
  }
  const id = Number(
      db
        .prepare(
          `INSERT INTO delivery_notes(client_request_id,delivery_number,sale_id,warehouse_id,customer_id,status,delivery_date,note,created_by) VALUES(?,?,?, ?,?,'DRAFT',?,?,?)`,
        )
        .run(
          data.client_request_id || null,
          Settings.nextDocumentNumber("DELIVERY_NOTE", sale.warehouse_id),
          sale.id,
          sale.warehouse_id,
          sale.customer_id,
          data.delivery_date || today(),
          String(data.note || "").trim() || null,
          user.id,
        ).lastInsertRowid,
    ),
    insert = db.prepare(
      "INSERT INTO delivery_note_lines(delivery_note_id,sale_line_id,product_id,designation,unit_name,quantity,base_quantity) VALUES(?,?,?,?,?,?,?)",
    );
  for (const input of lines) {
    const row = remaining.get(Number(input.sale_line_id));
    insert.run(
      id,
      row.sale_line_id,
      row.product_id,
      row.designation,
      row.unit_name,
      quantity(input.quantity),
      row.base_quantity == null
        ? null
        : quantity(Number(input.quantity) * Number(row.conversion_factor)),
    );
  }
  return data.validate_immediately
    ? validateDelivery(id, user)
    : hydrateDelivery(id);
});
function stockOut(line, note, user, settings) {
  if (!line.product_id || line.base_quantity == null) return;
  const product = db
    .prepare(
      "SELECT track_stock,track_batches,track_serials FROM products WHERE id=?",
    )
    .get(line.product_id);
  if (!product?.track_stock) return;
  if (product.track_serials)
    throw new CommercialError(
      `Serial-tracked product ${line.designation} is not supported for delivery validation`,
      409,
    );
  const available = Number(
    db
      .prepare(
        "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
      )
      .get(line.product_id, note.warehouse_id)?.quantity || 0,
  );
  if (
    available + 1e-9 < line.base_quantity &&
    !settings.sales.allow_negative_stock
  )
    throw new CommercialError(
      `Insufficient stock for ${line.designation}`,
      409,
    );
  let remaining = Number(line.base_quantity);
  if (product.track_batches) {
    const batches = db
      .prepare(
        "SELECT * FROM stock_batches WHERE product_id=? AND warehouse_id=? AND quantity>0 ORDER BY CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,expiration_date,received_at,id",
      )
      .all(line.product_id, note.warehouse_id);
    for (const batch of batches) {
      if (remaining <= 1e-9) break;
      if (
        batch.expiration_date &&
        batch.expiration_date < today() &&
        settings.expiration.block_expired_sale
      )
        continue;
      const used = Math.min(remaining, Number(batch.quantity));
      db.prepare("UPDATE stock_batches SET quantity=quantity-? WHERE id=?").run(
        used,
        batch.id,
      );
      db.prepare(
        "INSERT INTO delivery_batch_allocations(delivery_note_line_id,batch_id,quantity) VALUES(?,?,?)",
      ).run(line.id, batch.id, used);
      db.prepare(
        "INSERT INTO stock_movements(product_id,warehouse_id,batch_id,type,quantity,reference_type,reference_id,created_by) VALUES(?,?,?,'SALE',?,'DELIVERY_NOTE',?,?)",
      ).run(
        line.product_id,
        note.warehouse_id,
        batch.id,
        -used,
        String(note.id),
        user.id,
      );
      remaining -= used;
    }
    if (remaining > 1e-9 && !settings.sales.allow_negative_stock)
      throw new CommercialError(
        `No valid batch stock for ${line.designation}`,
        409,
      );
  }
  if (!product.track_batches || remaining > 1e-9)
    db.prepare(
      "INSERT INTO stock_movements(product_id,warehouse_id,type,quantity,reference_type,reference_id,created_by) VALUES(?,?,'SALE',?,'DELIVERY_NOTE',?,?)",
    ).run(
      line.product_id,
      note.warehouse_id,
      -(product.track_batches ? remaining : line.base_quantity),
      String(note.id),
      user.id,
    );
  db.prepare(
    "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,?) ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=quantity+excluded.quantity",
  ).run(line.product_id, note.warehouse_id, -line.base_quantity);
}
const validateDelivery = db.transaction((id, user) => {
  requireRole(user, ["admin", "manager", "stock"]);
  const note = hydrateDelivery(id);
  if (!note) throw new CommercialError("Delivery note not found", 404);
  authorizeWarehouse(note.warehouse_id, user);
  if (note.status === "VALIDATED") return note;
  if (note.status !== "DRAFT")
    throw new CommercialError("Only a draft delivery can be validated", 409);
  const current = new Map(
    deliveryProgress(note.sale_id).map((r) => [Number(r.sale_line_id), r]),
  );
  for (const line of note.lines) {
    const row = current.get(Number(line.sale_line_id));
    if (!row || Number(line.quantity) - row.remaining_quantity > 1e-9)
      throw new CommercialError(
        "Delivery quantity exceeds the remaining quantity",
        409,
      );
  }
  const settings = {
    sales: Settings.getGroup("sales"),
    expiration: Settings.getGroup("expiration"),
  };
  note.lines.forEach((line) => stockOut(line, note, user, settings));
  const number =
    note.delivery_number || Settings.nextDocumentNumber("DELIVERY_NOTE", note.warehouse_id);
  db.prepare(
    "UPDATE delivery_notes SET status='VALIDATED',delivery_number=?,validated_at=CURRENT_TIMESTAMP,validated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='DRAFT'",
  ).run(number, user.id, note.id);
  syncDeliveryStatus(note.sale_id);
  return hydrateDelivery(note.id);
});
function listDeliveries(filters, user) {
  const warehouse = authorizeWarehouse(filters.warehouse_id, user),
    page = Math.max(1, Number(filters.page) || 1),
    limit = [25, 50, 100].includes(Number(filters.limit))
      ? Number(filters.limit)
      : 25,
    params = { warehouse: warehouse.id },
    where = ["dn.warehouse_id=@warehouse"];
  if (filters.status) {
    where.push("dn.status=@status");
    params.status = filters.status;
  }
  if (filters.search) {
    where.push(
      "(dn.delivery_number LIKE @search OR s.sale_number LIKE @search OR c.name LIKE @search)",
    );
    params.search = `%${String(filters.search).trim()}%`;
  }
  if (filters.from) {
    where.push("dn.delivery_date>=@from");
    params.from = filters.from;
  }
  if (filters.to) {
    where.push("dn.delivery_date<=@to");
    params.to = filters.to;
  }
  const clause = where.join(" AND "),
    count = db
      .prepare(
        `SELECT COUNT(*) count FROM delivery_notes dn JOIN sales s ON s.id=dn.sale_id JOIN customers c ON c.id=dn.customer_id WHERE ${clause}`,
      )
      .get(params).count,
    items = db
      .prepare(
        `SELECT dn.*,s.sale_number,c.name customer_name,w.name warehouse_name,(SELECT COUNT(*) FROM delivery_note_lines WHERE delivery_note_id=dn.id) line_count FROM delivery_notes dn JOIN sales s ON s.id=dn.sale_id JOIN customers c ON c.id=dn.customer_id JOIN warehouses w ON w.id=dn.warehouse_id WHERE ${clause} ORDER BY dn.delivery_date DESC,dn.id DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit, offset: (page - 1) * limit });
  return {
    items,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.max(1, Math.ceil(count / limit)),
    },
  };
}
function deliveryDetail(id, user) {
  const note = hydrateDelivery(id);
  if (!note) throw new CommercialError("Delivery note not found", 404);
  authorizeWarehouse(note.warehouse_id, user);
  return note;
}
function cancelDelivery(id, user) {
  requireRole(user, ["admin", "manager"]);
  const note = deliveryDetail(id, user);
  if (note.status !== "DRAFT")
    throw new CommercialError("Only a draft delivery can be cancelled", 409);
  db.prepare(
    "UPDATE delivery_notes SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).run(id);
  return hydrateDelivery(id);
}
const updateDelivery = db.transaction((id, data, user) => {
  requireRole(user, ["admin", "manager", "stock"]);
  const note = deliveryDetail(id, user);
  if (note.status !== "DRAFT")
    throw new CommercialError(
      "A delivered BL is immutable; use a controlled return/correction document",
      409,
    );
  const remaining = new Map(
      deliveryProgress(note.sale_id).map((row) => [
        Number(row.sale_line_id),
        row,
      ]),
    ),
    inputs = (data.lines || []).filter((line) => Number(line.quantity) > 0);
  if (!inputs.length)
    throw new CommercialError("Add at least one delivery quantity");
  for (const input of inputs) {
    const row = remaining.get(Number(input.sale_line_id)),
      qty = quantity(input.quantity);
    if (!row || qty <= 0 || qty - row.remaining_quantity > 1e-9)
      throw new CommercialError(
        "Delivery quantity exceeds the remaining quantity",
        409,
      );
  }
  db.prepare("DELETE FROM delivery_note_lines WHERE delivery_note_id=?").run(
    note.id,
  );
  const insert = db.prepare(
    "INSERT INTO delivery_note_lines(delivery_note_id,sale_line_id,product_id,designation,unit_name,quantity,base_quantity) VALUES(?,?,?,?,?,?,?)",
  );
  for (const input of inputs) {
    const row = remaining.get(Number(input.sale_line_id));
    insert.run(
      note.id,
      row.sale_line_id,
      row.product_id,
      row.designation,
      row.unit_name,
      quantity(input.quantity),
      row.base_quantity == null
        ? null
        : quantity(Number(input.quantity) * Number(row.conversion_factor)),
    );
  }
  db.prepare(
    "UPDATE delivery_notes SET delivery_date=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).run(
    data.delivery_date || note.delivery_date,
    String(data.note || "").trim() || null,
    note.id,
  );
  return hydrateDelivery(note.id);
});

function invoiceProgress(saleId) {
  const sale = db
      .prepare("SELECT global_discount_percent FROM sales WHERE id=?")
      .get(saleId),
    factor = 1 - Number(sale?.global_discount_percent || 0) / 100;
  return db
    .prepare(
      `SELECT sl.*,COALESCE((SELECT SUM(sil.quantity) FROM sales_invoice_lines sil JOIN sales_invoices si ON si.id=sil.invoice_id WHERE sil.sale_line_id=sl.id AND si.status='ISSUED'),0) invoiced_quantity FROM sale_lines sl WHERE sl.sale_id=? ORDER BY sl.id`,
    )
    .all(saleId)
    .map((r) => {
      const allowed = Number(r.quantity),
        net = Number(r.subtotal) - Number(r.discount_amount),
        globalDiscount = net * (1 - factor);
      return {
        ...r,
        discount_amount: money(Number(r.discount_amount) + globalDiscount),
        total: money(net * factor),
        invoiceable_quantity: Math.max(
          0,
          quantity(allowed - Number(r.invoiced_quantity)),
        ),
      };
    });
}
function syncInvoiceStatus(saleId) {
  const rows = invoiceProgress(saleId),
    invoiced = rows.reduce((s, r) => s + Number(r.invoiced_quantity), 0),
    ordered = rows.reduce((s, r) => s + Number(r.quantity), 0),
    status =
      invoiced <= 1e-9
        ? "NOT_INVOICED"
        : invoiced + 1e-9 >= ordered
          ? "INVOICED"
          : "PARTIALLY_INVOICED";
  db.prepare("UPDATE sales SET invoice_status=? WHERE id=?").run(
    status,
    saleId,
  );
  return { invoice_status: status, lines: rows };
}
function hydrateInvoice(id) {
  const invoice = db
    .prepare(
      `SELECT si.*,s.sale_number,w.name warehouse_name,u.name issued_by_name FROM sales_invoices si JOIN sales s ON s.id=si.sale_id JOIN warehouses w ON w.id=s.warehouse_id LEFT JOIN users u ON u.id=si.issued_by WHERE si.id=?`,
    )
    .get(id);
  if (!invoice) return null;
  invoice.lines = db
    .prepare("SELECT * FROM sales_invoice_lines WHERE invoice_id=? ORDER BY id")
    .all(id);
  invoice.print_profile =
    Settings.profiles().find((p) => p.document_type === "SALE") || null;
  return invoice;
}
const issueInvoice = db.transaction((saleId, data, user) => {
  requireRole(user, ["admin", "manager"]);
  const sale = saleForAction(saleId, user),
    customer = activeCustomer(sale.customer_id),
    duplicate =
      data.client_request_id &&
      db
        .prepare("SELECT id FROM sales_invoices WHERE client_request_id=?")
        .get(data.client_request_id);
  if (duplicate) return hydrateInvoice(duplicate.id);
  const progress = new Map(
      invoiceProgress(sale.id).map((r) => [Number(r.id), r]),
    ),
    inputs = (data.lines || []).filter((l) => Number(l.quantity) > 0);
  if (!inputs.length)
    throw new CommercialError("Add at least one invoice quantity");
  let subtotal = 0,
    discount = 0,
    total = 0;
  const rows = inputs.map((input) => {
    const source = progress.get(Number(input.sale_line_id)),
      qty = quantity(input.quantity);
    if (!source || qty <= 0 || qty - source.invoiceable_quantity > 1e-9)
      throw new CommercialError(
        "Invoice quantity exceeds the invoiceable quantity",
        409,
      );
    const ratio = qty / Number(source.quantity),
      row = {
        ...source,
        quantity: qty,
        subtotal: money(Number(source.subtotal) * ratio),
        discount_amount: money(Number(source.discount_amount) * ratio),
        total: money(Number(source.total) * ratio),
      };
    subtotal += row.subtotal;
    discount += row.discount_amount;
    total += row.total;
    return row;
  });
  const id = Number(
      db
        .prepare(
          `INSERT INTO sales_invoices(client_request_id,invoice_number,sale_id,customer_id,invoice_date,issued_at,issued_by,subtotal,discount_amount,total,status,note,customer_name,customer_phone,customer_email,customer_address,customer_nif,customer_nis,customer_tax_article,customer_commercial_register,customer_business_activity,created_by) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,?,?,?,?,'ISSUED',?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          data.client_request_id || null,
          Settings.nextDocumentNumber("SALE_INVOICE", sale.warehouse_id),
          sale.id,
          customer.id,
          data.invoice_date || today(),
          user.id,
          money(subtotal),
          money(discount),
          money(total),
          String(data.note || "").trim() || null,
          customer.name,
          customer.phone,
          customer.email,
          customer.address,
          customer.nif,
          customer.nis,
          customer.tax_article,
          customer.commercial_register,
          customer.business_activity,
          user.id,
        ).lastInsertRowid,
    ),
    insert = db.prepare(
      `INSERT INTO sales_invoice_lines(invoice_id,sale_line_id,product_id,designation,unit_name,quantity,unit_price,discount_percent,discount_type,discount_value,discount_amount,subtotal,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
  rows.forEach((r) =>
    insert.run(
      id,
      r.id,
      r.product_id,
      r.designation,
      r.unit_name,
      r.quantity,
      r.unit_price,
      r.discount_percent,
      r.discount_type,
      r.discount_value,
      r.discount_amount,
      r.subtotal,
      r.total,
    ),
  );
  syncInvoiceStatus(sale.id);
  return hydrateInvoice(id);
});
function invoiceDetail(id, user) {
  const invoice = hydrateInvoice(id);
  if (!invoice) throw new CommercialError("Invoice not found", 404);
  saleForAction(invoice.sale_id, user);
  return invoice;
}

const addPayment = db.transaction((saleId, data, user) => {
  requireRole(user, ["admin", "manager"]);
  const sale = saleForAction(saleId, user),
    settings = {
      sales: Settings.getGroup("sales"),
      cash: Settings.getGroup("cash"),
    },
    summary = paymentSummary(sale.id, Number(sale.total)),
    amount = money(data.amount);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount - summary.balance_due > 0.001
  )
    throw new CommercialError("Payment exceeds the remaining balance", 409);
  const method = db
    .prepare("SELECT * FROM payment_methods WHERE code=? AND is_active=1")
    .get(data.payment_method_code);
  if (!method || method.code === "CUSTOMER_CREDIT")
    throw new CommercialError("Payment method is unavailable");
  let session = null;
  if (method.affects_cash_drawer) {
    session = db
      .prepare(
        `SELECT cs.* FROM cash_sessions cs JOIN cash_registers cr ON cr.id=cs.cash_register_id WHERE cs.user_id=? AND cs.status='open' AND cr.warehouse_id=?`,
      )
      .get(user.id, sale.warehouse_id);
    if (!session)
      throw new CommercialError(
        "An open cash session is required for cash payment",
        409,
      );
  }
  const paymentId = Number(
    db
      .prepare(
        "INSERT INTO sale_payments(sale_id,payment_method_code,amount,amount_received,change_amount,reference,cash_session_id,created_by) VALUES(?,?,?,?,0,?,?,?)",
      )
      .run(
        sale.id,
        method.code,
        amount,
        amount,
        String(data.reference || "").trim() || null,
        method.affects_cash_drawer ? session?.id : null,
        user.id,
      ).lastInsertRowid,
  );
  if (method.affects_cash_drawer)
    db.prepare(
      "INSERT INTO cash_movements(cash_session_id,direction,movement_type,amount,reference_type,reference_id,note,created_by) VALUES(?,'IN','SALE_PAYMENT',?,'SALE',?,?,?)",
    ).run(session.id, amount, sale.id, `Sale ${sale.sale_number}`, user.id);
  const creditEntry = db
    .prepare(
      "SELECT id FROM customer_account_entries WHERE sale_id=? AND entry_type='SALE_CREDIT'",
    )
    .get(sale.id);
  if (sale.customer_id && creditEntry)
    CustomerAccount.addEntry({
      customerId: sale.customer_id,
      entryType: "CUSTOMER_PAYMENT",
      amount: -amount,
      saleId: sale.id,
      paymentId,
      reference: sale.sale_number,
      description: "Règlement client",
      userId: user.id,
    });
  return syncPaymentStatus(sale.id);
});

function returnableLines(saleId) {
  const sale = db
    .prepare("SELECT fulfillment_type FROM sales WHERE id=?")
    .get(saleId);
  return db
    .prepare(
      `SELECT sl.*,COALESCE((SELECT SUM(srl.quantity) FROM sales_return_lines srl JOIN sales_returns sr ON sr.id=srl.return_id WHERE srl.sale_line_id=sl.id AND sr.status='VALIDATED'),0) returned_quantity,COALESCE((SELECT SUM(dl.quantity) FROM delivery_lines dl JOIN deliveries d ON d.id=dl.delivery_id WHERE dl.sale_line_id=sl.id AND d.status IN ('SHIPPED','DELIVERED')),0) delivered_quantity FROM sale_lines sl WHERE sl.sale_id=? ORDER BY sl.id`,
    )
    .all(saleId)
    .map((line) => {
      const fulfilled =
        sale.fulfillment_type === "IMMEDIATE"
          ? Number(line.quantity)
          : Number(line.delivered_quantity);
      return {
        ...line,
        returnable_quantity: Math.max(
          0,
          quantity(fulfilled - Number(line.returned_quantity)),
        ),
      };
    });
}
function hydrateReturn(id) {
  const result = db
    .prepare(
      `SELECT sr.*,s.sale_number,c.name customer_name,w.name warehouse_name,u.name validated_by_name FROM sales_returns sr JOIN sales s ON s.id=sr.sale_id LEFT JOIN customers c ON c.id=sr.customer_id JOIN warehouses w ON w.id=sr.warehouse_id LEFT JOIN users u ON u.id=sr.validated_by WHERE sr.id=?`,
    )
    .get(id);
  if (!result) return null;
  result.sale_date = result.return_date;
  result.lines = db
    .prepare("SELECT * FROM sales_return_lines WHERE return_id=? ORDER BY id")
    .all(id)
    .map((line) => ({
      ...line,
      serial_numbers: db
        .prepare(
          `SELECT ss.serial_number FROM sales_return_serial_allocations a
           JOIN stock_serials ss ON ss.id=a.serial_id
           WHERE a.sales_return_line_id=? ORDER BY a.id`,
        )
        .all(line.id)
        .map((serial) => serial.serial_number),
      batch_allocations: db
        .prepare(
          `SELECT a.batch_id,a.quantity,b.batch_number,b.expiration_date
           FROM sales_return_batch_allocations a
           JOIN stock_batches b ON b.id=a.batch_id
           WHERE a.sales_return_line_id=? ORDER BY a.id`,
        )
        .all(line.id),
    }));
  result.credit_note = db
    .prepare(`SELECT cn.* FROM invoice_credit_notes cn WHERE cn.sales_return_id=?`)
    .get(id) || null;
  result.return_total = money(result.return_total);
  result.total = result.return_total;
  result.print_profile =
    Settings.profiles().find((p) => p.document_type === "SALES_RETURN") || null;
  return result;
}
const createReturn = db.transaction((saleId, data, user) => {
  requireRole(user, ["admin", "manager"]);
  // Older resets/tests could leave the sequence behind an existing return
  // number. Synchronize it before reserving the next globally unique number.
  db.exec(`
    UPDATE document_sequences
    SET current_value=MAX(current_value,COALESCE((
      SELECT MAX(CAST(substr(return_number,-6) AS INTEGER))
      FROM sales_returns
    ),0))
    WHERE document_type='SALES_RETURN'
  `);
  const sale = saleForAction(saleId, user),
    duplicate =
      data.client_request_id &&
      db
        .prepare("SELECT id FROM sales_returns WHERE client_request_id=?")
        .get(data.client_request_id);
  if (duplicate) return hydrateReturn(duplicate.id);
  const availableRows = returnableLines(sale.id),
    available = new Map(availableRows.map((line) => [Number(line.id), line])),
    lineTotal = availableRows.reduce(
      (sum, line) => sum + Number(line.total),
      0,
    ),
    commercialFactor = lineTotal > 0 ? Number(sale.total) / lineTotal : 1,
    inputs = (data.lines || []).filter((line) => Number(line.quantity) > 0);
  if (!inputs.length)
    throw new CommercialError("Add at least one return quantity");
  const rows = inputs.map((input) => {
      const source = available.get(Number(input.sale_line_id)),
        qty = quantity(input.quantity);
      if (!source || qty <= 0 || qty - source.returnable_quantity > 1e-9)
        throw new CommercialError(
          "Return quantity exceeds the physically fulfilled quantity",
          409,
        );
      const product = source.product_id
        ? db
            .prepare(
              "SELECT track_stock,track_batches,track_serials FROM products WHERE id=?",
            )
            .get(source.product_id)
        : null;
      const historicalUnitTotal = money(
        (Number(source.total) / Number(source.quantity)) * commercialFactor,
      ),
        baseQuantity = source.base_quantity == null
          ? null
          : quantity(qty * Number(source.conversion_factor));
      let serialIds = [], batchAllocations = [];
      if (product?.track_serials) {
        if (!Number.isInteger(baseQuantity))
          throw new CommercialError(
            `Serialized return quantity must be a whole number for ${source.designation}`,
            409,
          );
        serialIds = db.prepare(
          `SELECT ss.id FROM sale_serial_allocations a
           JOIN stock_serials ss ON ss.id=a.serial_id
           WHERE a.sale_line_id=? AND ss.status='SOLD'
           ORDER BY a.id LIMIT ?`,
        ).all(source.id, baseQuantity).map((serial) => Number(serial.id));
        if (serialIds.length !== baseQuantity)
          throw new CommercialError(
            `Not enough sold serial numbers remain returnable for ${source.designation}`,
            409,
          );
      }
      if (product?.track_batches) {
        const soldBatches = db.prepare(
          `SELECT a.batch_id,
             a.quantity-COALESCE((SELECT SUM(rba.quantity)
               FROM sales_return_batch_allocations rba
               JOIN sales_return_lines srl ON srl.id=rba.sales_return_line_id
               JOIN sales_returns sr ON sr.id=srl.return_id
               WHERE srl.sale_line_id=a.sale_line_id AND rba.batch_id=a.batch_id
                 AND sr.status='VALIDATED'),0) available
           FROM sale_batch_allocations a
           WHERE a.sale_line_id=? ORDER BY a.id`,
        ).all(source.id);
        let remaining = Number(baseQuantity);
        for (const batch of soldBatches) {
          if (remaining <= 1e-9) break;
          const used = Math.min(remaining, Math.max(0, Number(batch.available)));
          if (used > 1e-9)
            batchAllocations.push({ batch_id: Number(batch.batch_id), quantity: quantity(used) });
          remaining = quantity(remaining - used);
        }
        if (remaining > 1e-9)
          throw new CommercialError(
            `Not enough sold batch quantity remains returnable for ${source.designation}`,
            409,
          );
      }
      return {
        ...source,
        quantity: qty,
        base_quantity: baseQuantity,
        serial_ids: serialIds,
        batch_allocations: batchAllocations,
        historical_unit_total: historicalUnitTotal,
        total: money(historicalUnitTotal * qty),
      };
    }),
    returnTotal = money(rows.reduce((sum, row) => sum + row.total, 0));
  const returnId = Number(
      db
        .prepare(
          `INSERT INTO sales_returns(client_request_id,return_number,sale_id,customer_id,warehouse_id,return_date,status,return_total,note,validated_at,validated_by,created_by) VALUES(?,?,?,?,?,?,'VALIDATED',?,?,CURRENT_TIMESTAMP,?,?)`,
        )
        .run(
          data.client_request_id || null,
          Settings.nextDocumentNumber("SALES_RETURN", sale.warehouse_id),
          sale.id,
          sale.customer_id,
          sale.warehouse_id,
          data.return_date || today(),
          returnTotal,
          String(data.note || "").trim() || null,
          user.id,
          user.id,
        ).lastInsertRowid,
    ),
    insert = db.prepare(
      "INSERT INTO sales_return_lines(return_id,sale_line_id,product_id,designation,unit_name,quantity,base_quantity,unit_price,historical_unit_total,total) VALUES(?,?,?,?,?,?,?,?,?,?)",
    );
  for (const row of rows) {
    const returnLineId = Number(insert.run(
      returnId,
      row.id,
      row.product_id,
      row.designation,
      row.unit_name,
      row.quantity,
      row.base_quantity,
      row.unit_price,
      row.historical_unit_total,
      row.total,
    ).lastInsertRowid);
    if (row.product_id && row.base_quantity != null) {
      db.prepare(
        "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,?) ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=quantity+excluded.quantity",
      ).run(row.product_id, sale.warehouse_id, row.base_quantity);
      if (row.serial_ids.length) {
        const restore = db.prepare(
            "UPDATE stock_serials SET status='AVAILABLE',sold_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='SOLD'",
          ),
          trace = db.prepare(
            "INSERT INTO sales_return_serial_allocations(sales_return_line_id,serial_id) VALUES(?,?)",
          );
        row.serial_ids.forEach((serialId) => {
          if (restore.run(serialId).changes !== 1)
            throw new CommercialError("Serial return conflict", 409);
          trace.run(returnLineId, serialId);
        });
      }
      if (row.batch_allocations.length) {
        const restoreBatch = db.prepare(
            "UPDATE stock_batches SET quantity=quantity+? WHERE id=?",
          ),
          traceBatch = db.prepare(
            "INSERT INTO sales_return_batch_allocations(sales_return_line_id,batch_id,quantity) VALUES(?,?,?)",
          ),
          batchMovement = db.prepare(
            "INSERT INTO stock_movements(product_id,warehouse_id,batch_id,type,quantity,reference_type,reference_id,created_by) VALUES(?,?,?,'CUSTOMER_RETURN',?,'SALES_RETURN',?,?)",
          );
        row.batch_allocations.forEach((allocation) => {
          restoreBatch.run(allocation.quantity, allocation.batch_id);
          traceBatch.run(returnLineId, allocation.batch_id, allocation.quantity);
          batchMovement.run(row.product_id, sale.warehouse_id, allocation.batch_id, allocation.quantity, String(returnId), user.id);
        });
      } else {
        db.prepare(
          "INSERT INTO stock_movements(product_id,warehouse_id,type,quantity,reference_type,reference_id,created_by) VALUES(?,?,'CUSTOMER_RETURN',?,'SALES_RETURN',?,?)",
        ).run(row.product_id, sale.warehouse_id, row.base_quantity, String(returnId), user.id);
      }
    }
  }
  // An issued invoice is immutable.  A physical return is linked to it through
  // a credit note instead of editing the original invoice or its lines.
  const invoice = db
    .prepare(
      `SELECT i.* FROM invoice_sales x JOIN invoices i ON i.id=x.invoice_id
       WHERE x.sale_id=? AND i.status='ISSUED' LIMIT 1`,
    )
    .get(sale.id);
  if (invoice) {
    db.prepare("UPDATE sales_returns SET invoice_id=? WHERE id=?").run(invoice.id, returnId);
    const invoiceLines = db
      .prepare("SELECT * FROM invoice_lines WHERE invoice_id=?")
      .all(invoice.id);
    const invoiceLineTotal = invoiceLines.reduce((sum, line) => sum + Number(line.total), 0);
    let creditSubtotal = 0;
    const creditRows = rows.map((row) => {
      const invoiceLine = invoiceLines.find((line) => Number(line.sale_line_id) === Number(row.id));
      const subtotal = invoiceLine && Number(invoiceLine.quantity) > 0
        ? money((Number(invoiceLine.total) / Number(invoiceLine.quantity)) * Number(row.quantity))
        : money(row.total);
      creditSubtotal = money(creditSubtotal + subtotal);
      return { row, invoiceLine, subtotal };
    });
    // Apply the invoice-wide discount proportionally, then its fiscal rules.
    const netSubtotal = invoiceLineTotal > 0
      ? money(creditSubtotal * (Number(invoice.subtotal) / invoiceLineTotal))
      : creditSubtotal;
    const taxAmount = invoice.tax_enabled ? money((netSubtotal * Number(invoice.tax_rate)) / 100) : 0;
    const stampAmount = invoice.stamp_enabled ? money((netSubtotal * Number(invoice.stamp_rate)) / 100) : 0;
    const creditTotal = money(netSubtotal + taxAmount + stampAmount);
    const creditNoteId = Number(
      db.prepare(`INSERT INTO invoice_credit_notes(credit_note_number,invoice_id,sales_return_id,credit_note_date,subtotal,tax_amount,stamp_amount,total,note,created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
        Settings.nextDocumentNumber("CREDIT_NOTE", sale.warehouse_id), invoice.id, returnId,
        data.return_date || today(), netSubtotal, taxAmount, stampAmount, creditTotal,
        String(data.note || "").trim() || null, user.id,
      ).lastInsertRowid,
    );
    const returnLines = db.prepare("SELECT * FROM sales_return_lines WHERE return_id=? ORDER BY id").all(returnId);
    const creditInsert = db.prepare(`INSERT INTO invoice_credit_note_lines(credit_note_id,invoice_line_id,sales_return_line_id,quantity,subtotal,total)
      VALUES(?,?,?,?,?,?)`);
    creditRows.forEach((item, index) => {
      const ratio = creditSubtotal > 0 ? item.subtotal / creditSubtotal : 0;
      creditInsert.run(creditNoteId, item.invoiceLine?.id || null, returnLines[index].id, item.row.quantity,
        money(netSubtotal * ratio), money(creditTotal * ratio));
    });
  }
  // A return lowers the customer's debt (or creates a customer credit when
  // the sale was already paid).  A cash refund consumes that credit and is a
  // separate OUT transaction and cash movement.
  const settlementMode = data.settlement_mode === "REFUND" ? "REFUND" : "CUSTOMER_CREDIT";
  let refundAmount = 0;
  if (sale.customer_id) {
    CustomerAccount.addEntry({
      customerId: sale.customer_id, entryType: "ADJUSTMENT", amount: -returnTotal,
      saleId: sale.id, returnId, entryRole: "RETURN_REDUCTION", reference: `RETURN:${returnId}`,
      description: "Réduction suite à un retour client", userId: user.id,
    });
    if (settlementMode === "REFUND") {
      const available = CustomerAccount.summary(sale.customer_id).available_credit;
      const requested = data.refund_amount == null || data.refund_amount === "" ? available : money(data.refund_amount);
      if (!(requested > 0) || requested - available > 0.001)
        throw new CommercialError("Refund exceeds the customer's available credit", 409);
      refundAmount = requested;
    }
  } else if (settlementMode === "REFUND") {
    refundAmount = data.refund_amount == null || data.refund_amount === "" ? returnTotal : money(data.refund_amount);
    if (!(refundAmount > 0) || refundAmount - returnTotal > 0.001)
      throw new CommercialError("Refund amount is invalid", 409);
  }
  if (refundAmount > 0) {
    const method = db.prepare("SELECT * FROM payment_methods WHERE code=? AND is_active=1").get(data.refund_payment_method_code || "CASH");
    if (!method?.affects_cash_drawer)
      throw new CommercialError("A cash payment method is required for a cash refund", 409);
    const session = db.prepare(`SELECT cs.* FROM cash_sessions cs JOIN cash_registers cr ON cr.id=cs.cash_register_id
      WHERE cs.user_id=? AND cs.status='open' AND cr.warehouse_id=?`).get(user.id, sale.warehouse_id);
    if (!session) throw new CommercialError("An open cash session is required for cash refund", 409);
    db.prepare("UPDATE sales_returns SET settlement_mode='REFUND',refund_amount=? WHERE id=?").run(refundAmount, returnId);
    db.prepare("INSERT INTO cash_movements(cash_session_id,direction,movement_type,amount,reference_type,reference_id,note,created_by) VALUES(?,'OUT','CUSTOMER_REFUND',?,'SALES_RETURN',?,?,?)")
      .run(session.id, refundAmount, returnId, `Remboursement retour ${returnId}`, user.id);
    db.prepare("INSERT INTO financial_transactions(direction,party_type,customer_id,payment_method_code,amount,reference,source_type,sales_return_id,cash_session_id,created_by) VALUES('OUT','CUSTOMER',?,?,?,?,?,?,?,?)")
      .run(sale.customer_id || null, method.code, refundAmount, `RETURN:${returnId}`, "CUSTOMER_RETURN_REFUND", returnId, session.id, user.id);
    if (sale.customer_id)
      CustomerAccount.addEntry({
        customerId: sale.customer_id, entryType: "ADJUSTMENT", amount: refundAmount,
        saleId: sale.id, returnId, entryRole: "RETURN_REFUND", reference: `RETURN_REFUND:${returnId}`,
        description: "Remboursement client suite à un retour", userId: user.id,
      });
  } else {
    db.prepare("UPDATE sales_returns SET settlement_mode='CUSTOMER_CREDIT',refund_amount=0 WHERE id=?").run(returnId);
  }
  const after = returnableLines(sale.id),
    returned = after.reduce(
      (sum, row) => sum + Number(row.returned_quantity),
      0,
    ),
    remaining = after.reduce(
      (sum, row) => sum + Number(row.returnable_quantity),
      0,
    ),
    status =
      returned <= 1e-9
        ? "NOT_RETURNED"
        : remaining <= 1e-9
          ? "FULLY_RETURNED"
          : "PARTIALLY_RETURNED";
  db.prepare("UPDATE sales SET return_status=? WHERE id=?").run(
    status,
    sale.id,
  );
  syncPaymentStatus(sale.id);
  return hydrateReturn(returnId);
});
function returnDetail(id, user) {
  const result = hydrateReturn(id);
  if (!result) throw new CommercialError("Return not found", 404);
  saleForAction(result.sale_id, user);
  return result;
}

module.exports = {
  CommercialError,
  saveQuote,
  updateQuote,
  listQuotes,
  quoteDetail,
  setQuoteStatus,
  addPayment,
  paymentSummary,
  syncPaymentStatus,
  createReturn,
  returnDetail,
  returnableLines,
};
