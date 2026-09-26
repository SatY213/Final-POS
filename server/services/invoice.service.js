const db = require("../config/database"),
  Settings = require("./settings.service"),
  SalePayment = require("./sale-payment.service"),
  CustomerAccount = require("./customer-account.service");
class InvoiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const money = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100,
  today = () => new Date().toISOString().slice(0, 10);
function authorize(warehouseId, user) {
  if (
    user.role !== "admin" &&
    user.warehouse_id != null &&
    Number(user.warehouse_id) !== Number(warehouseId)
  )
    throw new InvoiceError("Invoice is unauthorized", 403);
}
function nextNumberPreview() {
  const row = db
    .prepare(
      "SELECT current_value FROM document_sequences WHERE document_type='INVOICE'",
    )
    .get();
  const numbering = Settings.getGroup("numbering"),
    parts = ["FAC"];
  if (numbering.sale_include_year) parts.push(String(new Date().getFullYear()));
  parts.push(
    String(Number(row?.current_value || 0) + 1).padStart(
      numbering.sale_padding,
      "0",
    ),
  );
  return parts.join("-");
}
function detail(id, user) {
  const invoice = db
    .prepare(
      `SELECT i.*,c.name customer_name,c.phone customer_phone,c.email customer_email,c.nif customer_nif,c.nis customer_nis,c.rib customer_rib,c.tax_article customer_tax_article,c.commercial_register customer_commercial_register,c.address customer_address,c.business_activity customer_business_activity,w.name warehouse_name,w.phone warehouse_phone,w.email warehouse_email,w.nif warehouse_nif,w.nis warehouse_nis,w.rib warehouse_rib,w.tax_article warehouse_tax_article,w.commercial_register warehouse_commercial_register,w.address warehouse_address,w.business_activity warehouse_business_activity,u.name created_by_name FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id JOIN warehouses w ON w.id=i.warehouse_id JOIN users u ON u.id=i.created_by WHERE i.id=?`,
    )
    .get(Number(id));
  if (!invoice) throw new InvoiceError("Invoice not found", 404);
  authorize(invoice.warehouse_id, user);
  invoice.sales = db
    .prepare(
      `SELECT s.id,s.sale_number,s.document_type,s.sale_date,s.customer_id,s.total,link.amount,
       COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id=s.id AND p.invoice_payment_id IS NULL),0) direct_paid_amount,
       COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id=s.id),0) sale_paid_amount
       FROM invoice_sales link JOIN sales s ON s.id=link.sale_id WHERE link.invoice_id=? ORDER BY s.sale_date,s.id`,
    )
    .all(invoice.id);
  invoice.lines = db
    .prepare(
      `SELECT l.*,s.sale_number FROM invoice_lines l JOIN sales s ON s.id=l.sale_id WHERE l.invoice_id=? ORDER BY l.id`,
    )
    .all(invoice.id);
  invoice.source_lines = db
    .prepare(
      `SELECT sl.*,s.sale_number FROM invoice_sales x JOIN sales s ON s.id=x.sale_id JOIN sale_lines sl ON sl.sale_id=s.id WHERE x.invoice_id=? ORDER BY s.sale_date,s.id,sl.id`,
    )
    .all(invoice.id);
  invoice.payments = db
    .prepare(
      `SELECT p.*,pm.name payment_method_name FROM invoice_payments p JOIN payment_methods pm ON pm.code=p.payment_method_code WHERE p.invoice_id=? ORDER BY p.id`,
    )
    .all(invoice.id);
  invoice.credit_notes = db
    .prepare(
      "SELECT cn.*,sr.return_number,s.sale_number FROM invoice_credit_notes cn JOIN sales_returns sr ON sr.id=cn.sales_return_id JOIN sales s ON s.id=sr.sale_id WHERE cn.invoice_id=? ORDER BY cn.id",
    )
    .all(invoice.id);
  invoice.new_paid = money(
    invoice.payments.reduce((s, p) => s + Number(p.amount), 0),
  );
  invoice.sales_paid = money(
    invoice.sales.reduce(
      (sum, sale) => sum + Number(sale.direct_paid_amount),
      0,
    ),
  );
  invoice.credit_amount = money(
    invoice.credit_notes.reduce((sum, note) => sum + Number(note.total), 0),
  );
  invoice.paid_amount = money(invoice.sales_paid + invoice.new_paid);
  invoice.balance_due = Math.max(
    0,
    money(Number(invoice.total) - invoice.credit_amount - invoice.paid_amount),
  );
  invoice.overpaid_amount = Math.max(
    0,
    money(invoice.paid_amount + invoice.credit_amount - Number(invoice.total)),
  );
  invoice.payment_status =
    invoice.balance_due <= 0
      ? "PAID"
      : invoice.paid_amount > 0 || invoice.credit_amount > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";
  invoice.print_profile =
    Settings.profiles().find(
      (profile) => profile.is_active && profile.document_type === "INVOICE",
    ) || null;
  return invoice;
}

// Sales keep their own debt/payment history. This single ledger adjustment
// represents only the difference between the invoice position and the open
// balances of its source sales (taxes, price corrections or an overpayment).
// It is updated in place so editing an invoice never rewrites a payment.
function syncInvoiceAccount(invoice, userId) {
  const reference = `INVOICE_BALANCE:${invoice.id}`;
  const existing = db
    .prepare(
      "SELECT id FROM customer_account_entries WHERE entry_type='ADJUSTMENT' AND reference=?",
    )
    .get(reference);
  const salesBalance = money(
    invoice.sales.reduce(
      (sum, sale) =>
        sum + SalePayment.paymentSummary(sale.id, sale.total).balance_due,
      0,
    ),
  );
  const adjustment = money(
    Number(invoice.balance_due) - salesBalance - Number(invoice.overpaid_amount),
  );
  if (Math.abs(adjustment) <= 0.001 || !invoice.customer_id) {
    if (existing)
      db.prepare("DELETE FROM customer_account_entries WHERE id=?").run(existing.id);
    return 0;
  }
  const description =
    adjustment > 0
      ? `Solde complémentaire de la facture ${invoice.invoice_number}`
      : `Crédit issu de la facture ${invoice.invoice_number}`;
  if (existing)
    db.prepare(
      `UPDATE customer_account_entries
       SET customer_id=?,amount=?,sale_id=NULL,payment_id=NULL,description=?,created_by=?
       WHERE id=?`,
    ).run(invoice.customer_id, adjustment, description, userId, existing.id);
  else
    CustomerAccount.addEntry({
      customerId: invoice.customer_id,
      entryType: "ADJUSTMENT",
      amount: adjustment,
      reference,
      description,
      userId,
    });
  return adjustment;
}
function context(query, user) {
  const warehouseId = Number(query.warehouse_id);
  if (!warehouseId) throw new InvoiceError("Warehouse is required");
  authorize(warehouseId, user);
  return {
    settings: Settings.getGroup("invoicing"),
    payment_methods: db
      .prepare(
        "SELECT * FROM payment_methods WHERE is_active=1 AND code<>'CUSTOMER_CREDIT' ORDER BY sort_order,id",
      )
      .all(),
    next_invoice_number: nextNumberPreview(),
  };
}
function eligibleSales(query, user) {
  const warehouse = Number(query.warehouse_id);
  authorize(warehouse, user);
  const where = [
      "s.warehouse_id=@warehouse",
      "s.sale_status='CONFIRMED'",
      "NOT EXISTS(SELECT 1 FROM invoice_sales x JOIN invoices i ON i.id=x.invoice_id WHERE x.sale_id=s.id AND i.status='ISSUED')",
    ],
    params = { warehouse };
  if (query.search) {
    where.push("(s.sale_number LIKE @search OR c.name LIKE @search)");
    params.search = `%${String(query.search).trim()}%`;
  }
  if (query.from) {
    where.push("s.sale_date>=@from");
    params.from = query.from;
  }
  if (query.to) {
    where.push("s.sale_date<=@to");
    params.to = query.to;
  }
  if (query.customer_id) {
    where.push("s.customer_id=@customer");
    params.customer = Number(query.customer_id);
  }
  const rows = db
      .prepare(
        `SELECT s.id,s.sale_number,s.document_type,s.sale_date,s.customer_id,s.total,c.name customer_name,COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id=s.id),0) paid_amount FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE ${where.join(" AND ")} ORDER BY s.sale_date DESC,s.id DESC LIMIT 100`,
      )
      .all(params),
    lines = db.prepare("SELECT * FROM sale_lines WHERE sale_id=? ORDER BY id");
  return rows.map((s) => ({ ...s, lines: lines.all(s.id) }));
}
function calcLine(input, source) {
  const quantity = Number(input.quantity),
    unitPrice = money(input.unit_price),
    type = input.discount_type === "FIXED" ? "FIXED" : "PERCENT",
    value = Number(input.discount_value || 0);
  if (
    !(quantity > 0) ||
    quantity - Number(source.quantity) > 0.000001 ||
    unitPrice < 0 ||
    value < 0 ||
    (type === "PERCENT" && value > 100)
  )
    throw new InvoiceError("Invoice line values are invalid");
  const subtotal = money(quantity * unitPrice),
    discount = money(
      type === "FIXED" ? Math.min(value, subtotal) : (subtotal * value) / 100,
    );
  return {
    quantity,
    unitPrice,
    type,
    value,
    subtotal,
    discount,
    total: money(subtotal - discount),
  };
}
const createForSales = db.transaction((saleIds, data = {}, user) => {
  const ids = [
    ...new Set((saleIds || []).map(Number).filter(Number.isInteger)),
  ];
  if (!ids.length)
    throw new InvoiceError("Select at least one sale to invoice");
  const ph = ids.map(() => "?").join(","),
    sales = db
      .prepare(
        `SELECT * FROM sales WHERE id IN (${ph}) AND sale_status='CONFIRMED'`,
      )
      .all(...ids);
  if (sales.length !== ids.length)
    throw new InvoiceError("A selected sale is unavailable", 409);
  const warehouse = Number(sales[0].warehouse_id),
    customer =
      sales[0].customer_id == null ? null : Number(sales[0].customer_id);
  if (
    sales.some(
      (s) =>
        Number(s.warehouse_id) !== warehouse ||
        Number(s.customer_id || 0) !== Number(customer || 0),
    )
  )
    throw new InvoiceError(
      "All invoiced sales must have the same customer and warehouse",
      409,
    );
  authorize(warehouse, user);
  const existing = db
    .prepare(
      `SELECT invoice_id FROM invoice_sales l JOIN invoices i ON i.id=l.invoice_id WHERE l.sale_id IN (${ph}) AND i.status='ISSUED' LIMIT 1`,
    )
    .get(...ids);
  if (existing) return detail(existing.invoice_id, user);
  const requestId = String(data.client_request_id || "").trim() || null;
  if (requestId) {
    const old = db
      .prepare("SELECT id FROM invoices WHERE client_request_id=?")
      .get(requestId);
    if (old) return detail(old.id, user);
  }
  const sources = new Map(
      db
        .prepare(`SELECT * FROM sale_lines WHERE sale_id IN (${ph})`)
        .all(...ids)
        .map((l) => [Number(l.id), l]),
    ),
    inputs = data.lines?.length
      ? data.lines
      : [...sources.values()].map((l) => ({
          sale_line_id: l.id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_type: l.discount_type,
          discount_value: l.discount_value,
        })),
    lines = inputs.map((input) => {
      const source = sources.get(Number(input.sale_line_id));
      if (!source)
        throw new InvoiceError(
          "An invoice line does not belong to the selected sales",
        );
      return { source, ...calcLine(input, source) };
    });
  if (!lines.length)
    throw new InvoiceError("Invoice must contain at least one line");
  const lineTotal = money(lines.reduce((s, l) => s + l.total, 0)),
    discountType = data.discount_type === "FIXED" ? "FIXED" : "PERCENT",
    discountValue = Number(data.discount_value || 0);
  if (discountValue < 0 || (discountType === "PERCENT" && discountValue > 100))
    throw new InvoiceError("Global discount is invalid");
  const discountAmount = money(
      discountType === "FIXED"
        ? Math.min(discountValue, lineTotal)
        : (lineTotal * discountValue) / 100,
    ),
    subtotal = money(lineTotal - discountAmount),
    taxEnabled = !!data.tax_enabled,
    taxRate = taxEnabled ? Number(data.tax_rate || 0) : 0;
  if (taxRate < 0 || taxRate > 100)
    throw new InvoiceError("Tax rate is invalid");
  const taxAmount = money((subtotal * taxRate) / 100),
    stampEnabled = !!data.stamp_enabled,
    stampRate = stampEnabled ? Number(data.stamp_rate || 0) : 0,
    stampAmount = stampEnabled ? money((subtotal * stampRate) / 100) : 0,
    total = money(subtotal + taxAmount + stampAmount),
    paidBefore = money(
      sales.reduce(
        (s, x) => s + SalePayment.paymentSummary(x.id, x.total).paid_amount,
        0,
      ),
    );
  if (stampRate < 0 || stampRate > 100)
    throw new InvoiceError("Fiscal stamp rate is invalid");
  let number = String(data.invoice_number || "").trim();
  if (!number || number === nextNumberPreview())
    number = Settings.nextDocumentNumber("INVOICE");
  else if (
    db.prepare("SELECT 1 FROM invoices WHERE invoice_number=?").get(number)
  )
    throw new InvoiceError("Invoice number already exists", 409);
  const invoiceId = Number(
    db
      .prepare(
        `INSERT INTO invoices(client_request_id,invoice_number,customer_id,warehouse_id,invoice_date,subtotal,discount_type,discount_value,discount_amount,tax_enabled,tax_rate,tax_amount,stamp_enabled,stamp_rate,stamp_amount,paid_before,total,note,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        requestId,
        number,
        customer,
        warehouse,
        data.invoice_date || today(),
        subtotal,
        discountType,
        discountValue,
        discountAmount,
        +taxEnabled,
        taxRate,
        taxAmount,
        +stampEnabled,
        stampRate,
        stampAmount,
        paidBefore,
        total,
        String(data.note || "").trim() || null,
        user.id,
      ).lastInsertRowid,
  );
  const link = db.prepare(
    "INSERT INTO invoice_sales(invoice_id,sale_id,amount) VALUES(?,?,?)",
  );
  sales.forEach((s) => link.run(invoiceId, s.id, s.total));
  const insert = db.prepare(
    `INSERT INTO invoice_lines(invoice_id,sale_id,sale_line_id,designation,unit_name,quantity,unit_price,discount_type,discount_value,discount_amount,subtotal,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  lines.forEach((l) =>
    insert.run(
      invoiceId,
      l.source.sale_id,
      l.source.id,
      l.source.designation,
      l.source.unit_name,
      l.quantity,
      l.unitPrice,
      l.type,
      l.value,
      l.discount,
      l.subtotal,
      l.total,
    ),
  );
  let invoice = detail(invoiceId, user);
  syncInvoiceAccount(invoice, user.id);
  invoice = detail(invoiceId, user);
  return invoice;
});
const addPayment = db.transaction((invoiceId, data, user) => {
  const invoice = detail(invoiceId, user),
    amount = money(data.amount),
    requestId = String(data.client_request_id || "").trim();
  if (!requestId)
    throw new InvoiceError("Payment request identifier is required");
  const priorPayment = db
    .prepare("SELECT invoice_id,amount FROM invoice_payments WHERE client_request_id=?")
    .get(requestId);
  if (priorPayment && Number(priorPayment.invoice_id) !== Number(invoiceId))
    throw new InvoiceError("Payment request identifier is already used", 409);
  if (priorPayment && Math.abs(Number(priorPayment.amount) - amount) > 0.001)
    throw new InvoiceError("Payment request identifier is already used", 409);
  if (priorPayment)
    return invoice;
  if (!(amount > 0) || amount - invoice.balance_due > 0.001)
    throw new InvoiceError("Payment exceeds the remaining balance", 409);
  const method = db
    .prepare(
      "SELECT * FROM payment_methods WHERE code=? AND is_active=1 AND code<>'CUSTOMER_CREDIT'",
    )
    .get(data.payment_method_code);
  if (!method) throw new InvoiceError("Payment method is unavailable");
  let session = null;
  if (method.affects_cash_drawer) {
    session = db
      .prepare(
        `SELECT cs.* FROM cash_sessions cs JOIN cash_registers cr ON cr.id=cs.cash_register_id WHERE cs.user_id=? AND cs.status='open' AND cr.warehouse_id=?`,
      )
      .get(user.id, invoice.warehouse_id);
    if (!session)
      throw new InvoiceError(
        "An open cash session is required for cash payment",
        409,
      );
  }
  const pid = Number(
    db
      .prepare(
        `INSERT INTO invoice_payments(client_request_id,invoice_id,payment_method_code,amount,reference,cash_session_id,created_by) VALUES(?,?,?,?,?,?,?)`,
      )
      .run(
        requestId,
        invoice.id,
        method.code,
        amount,
        String(data.reference || "").trim() || null,
        session?.id || null,
        user.id,
      ).lastInsertRowid,
  );
  let remaining = amount;
  for (const sale of invoice.sales) {
    const summary = SalePayment.paymentSummary(sale.id, sale.total),
      allocation = money(Math.min(remaining, summary.balance_due));
    if (allocation <= 0) continue;
    const spid = Number(
      db
        .prepare(
          `INSERT INTO sale_payments(sale_id,payment_method_code,amount,amount_received,change_amount,reference,cash_session_id,created_by,invoice_payment_id) VALUES(?,?,?,?,0,?,?,?,?)`,
        )
        .run(
          sale.id,
          method.code,
          allocation,
          allocation,
          String(data.reference || "").trim() || null,
          session?.id || null,
          user.id,
          pid,
        ).lastInsertRowid,
    );
    db.prepare(
      "INSERT INTO invoice_payment_allocations(invoice_payment_id,sale_id,sale_payment_id,amount) VALUES(?,?,?,?)",
    ).run(pid, sale.id, spid, allocation);
    if (
      sale.customer_id &&
      db
        .prepare(
          "SELECT 1 FROM customer_account_entries WHERE sale_id=? AND entry_type='SALE_CREDIT'",
        )
        .get(sale.id)
    )
      CustomerAccount.addEntry({
        customerId: sale.customer_id,
        entryType: "CUSTOMER_PAYMENT",
        amount: -allocation,
        saleId: sale.id,
        paymentId: spid,
        reference: invoice.invoice_number,
        description: "Règlement facture client",
        userId: user.id,
      });
    SalePayment.syncPaymentStatus(sale.id);
    remaining = money(remaining - allocation);
  }
  // The part covering VAT/stamp or removed invoice lines belongs to the invoice
  // payment only. It must not artificially overpay an underlying sale.
  if (method.affects_cash_drawer)
    db.prepare(
      "INSERT INTO cash_movements(cash_session_id,direction,movement_type,amount,reference_type,reference_id,note,created_by) VALUES(?,'IN','SALE_PAYMENT',?,'INVOICE',?,?,?)",
    ).run(
      session.id,
      amount,
      invoice.id,
      `Facture ${invoice.invoice_number}`,
      user.id,
    );
  let updated = detail(invoice.id, user);
  syncInvoiceAccount(updated, user.id);
  updated = detail(invoice.id, user);
  return updated;
});
const update = db.transaction((invoiceId, data, user) => {
  if (!["admin", "manager"].includes(user.role))
    throw new InvoiceError("Only a manager can edit an invoice", 403);
  const current = detail(invoiceId, user);
  if (current.status !== "ISSUED")
    throw new InvoiceError("Only an issued invoice can be edited", 409);
  const customerId =
    data.customer_id == null || data.customer_id === ""
      ? null
      : Number(data.customer_id);
  if (
    customerId &&
    !db
      .prepare("SELECT 1 FROM customers WHERE id=? AND is_active=1")
      .get(customerId)
  )
    throw new InvoiceError("Customer is unavailable", 409);
  const number = String(data.invoice_number || "").trim();
  if (!number) throw new InvoiceError("Invoice number is required");
  if (
    db
      .prepare("SELECT 1 FROM invoices WHERE invoice_number=? AND id<>?")
      .get(number, current.id)
  )
    throw new InvoiceError("Invoice number already exists", 409);
  const linkedSaleIds = current.sales.map((sale) => Number(sale.id));
  const requestedSaleIds = [
    ...new Set(
      (data.sale_ids || linkedSaleIds).map(Number).filter(Number.isInteger),
    ),
  ];
  if (!requestedSaleIds.length)
    throw new InvoiceError("Invoice must remain linked to at least one sale");
  if (linkedSaleIds.some((id) => !requestedSaleIds.includes(id)))
    throw new InvoiceError(
      "A linked sale cannot be removed from an issued invoice",
      409,
    );
  const placeholders = requestedSaleIds.map(() => "?").join(",");
  const linkedSales = db
    .prepare(
      `SELECT * FROM sales WHERE id IN (${placeholders}) AND sale_status='CONFIRMED'`,
    )
    .all(...requestedSaleIds);
  if (
    linkedSales.length !== requestedSaleIds.length ||
    linkedSales.some(
      (sale) => Number(sale.warehouse_id) !== Number(current.warehouse_id),
    )
  )
    throw new InvoiceError("A selected sale is unavailable", 409);
  const sourceCustomer =
    current.sales[0]?.customer_id == null
      ? null
      : Number(current.sales[0].customer_id);
  if (
    linkedSales.some(
      (sale) =>
        (sale.customer_id == null ? null : Number(sale.customer_id)) !==
        sourceCustomer,
    )
  )
    throw new InvoiceError("All linked sales must have the same customer", 409);
  const otherInvoice = db
    .prepare(
      `SELECT l.sale_id FROM invoice_sales l JOIN invoices i ON i.id=l.invoice_id WHERE l.sale_id IN (${placeholders}) AND l.invoice_id<>? AND i.status='ISSUED' LIMIT 1`,
    )
    .get(...requestedSaleIds, current.id);
  if (otherInvoice)
    throw new InvoiceError("A selected sale is already invoiced", 409);
  const sourceRows = db
    .prepare(
      `SELECT sl.* FROM sale_lines sl WHERE sl.sale_id IN (${placeholders})`,
    )
    .all(...requestedSaleIds);
  const sources = new Map(sourceRows.map((line) => [Number(line.id), line]));
  if (!Array.isArray(data.lines) || !data.lines.length)
    throw new InvoiceError("Invoice must contain at least one line");
  const lines = data.lines.map((input) => {
    const source = sources.get(Number(input.sale_line_id));
    if (!source)
      throw new InvoiceError(
        "An invoice line does not belong to a linked sale",
      );
    return { source, ...calcLine(input, source) };
  });
  const lineTotal = money(lines.reduce((sum, line) => sum + line.total, 0));
  const discountType = data.discount_type === "FIXED" ? "FIXED" : "PERCENT",
    discountValue = Number(data.discount_value || 0);
  if (discountValue < 0 || (discountType === "PERCENT" && discountValue > 100))
    throw new InvoiceError("Global discount is invalid");
  const discountAmount = money(
      discountType === "FIXED"
        ? Math.min(discountValue, lineTotal)
        : (lineTotal * discountValue) / 100,
    ),
    subtotal = money(lineTotal - discountAmount),
    taxEnabled = !!data.tax_enabled,
    taxRate = taxEnabled ? Number(data.tax_rate || 0) : 0,
    stampEnabled = !!data.stamp_enabled,
    stampRate = stampEnabled ? Number(data.stamp_rate || 0) : 0;
  if (taxRate < 0 || taxRate > 100)
    throw new InvoiceError("Tax rate is invalid");
  if (stampRate < 0 || stampRate > 100)
    throw new InvoiceError("Fiscal stamp rate is invalid");
  const taxAmount = money((subtotal * taxRate) / 100),
    stampAmount = money((subtotal * stampRate) / 100),
    total = money(subtotal + taxAmount + stampAmount);
  db.prepare(
    `UPDATE invoices SET invoice_number=?,customer_id=?,invoice_date=?,subtotal=?,discount_type=?,discount_value=?,discount_amount=?,tax_enabled=?,tax_rate=?,tax_amount=?,stamp_enabled=?,stamp_rate=?,stamp_amount=?,total=?,note=? WHERE id=?`,
  ).run(
    number,
    customerId,
    data.invoice_date || today(),
    subtotal,
    discountType,
    discountValue,
    discountAmount,
    +taxEnabled,
    taxRate,
    taxAmount,
    +stampEnabled,
    stampRate,
    stampAmount,
    total,
    String(data.note || "").trim() || null,
    current.id,
  );
  const insertLink = db.prepare(
    "INSERT OR IGNORE INTO invoice_sales(invoice_id,sale_id,amount) VALUES(?,?,?)",
  );
  linkedSales.forEach((sale) =>
    insertLink.run(current.id, sale.id, sale.total),
  );
  db.prepare("DELETE FROM invoice_lines WHERE invoice_id=?").run(current.id);
  const insert = db.prepare(
    `INSERT INTO invoice_lines(invoice_id,sale_id,sale_line_id,designation,unit_name,quantity,unit_price,discount_type,discount_value,discount_amount,subtotal,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  lines.forEach((line) =>
    insert.run(
      current.id,
      line.source.sale_id,
      line.source.id,
      line.source.designation,
      line.source.unit_name,
      line.quantity,
      line.unitPrice,
      line.type,
      line.value,
      line.discount,
      line.subtotal,
      line.total,
    ),
  );
  let updated = detail(current.id, user);
  syncInvoiceAccount(updated, user.id);
  updated = detail(current.id, user);
  return updated;
});
function list(query, user) {
  const warehouse = Number(query.warehouse_id);
  authorize(warehouse, user);
  const where = ["i.warehouse_id=@warehouse"],
    params = { warehouse };
  if (query.search) {
    where.push("(i.invoice_number LIKE @search OR c.name LIKE @search)");
    params.search = `%${String(query.search).trim()}%`;
  }
  if (query.from) {
    where.push("i.invoice_date>=@from");
    params.from = query.from;
  }
  if (query.to) {
    where.push("i.invoice_date<=@to");
    params.to = query.to;
  }
  const page = Math.max(1, Number(query.page) || 1),
    limit = Math.min(100, Math.max(10, Number(query.limit) || 25)),
    clause = where.join(" AND ");
  const total = Number(
      db
        .prepare(
          `SELECT COUNT(*) count FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE ${clause}`,
        )
        .get(params).count,
    ),
    items = db
      .prepare(
        `SELECT i.*,c.name customer_name,
         COALESCE((SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id=i.id),0) new_paid,
         COALESCE((SELECT SUM(sp.amount) FROM invoice_sales x JOIN sale_payments sp ON sp.sale_id=x.sale_id WHERE x.invoice_id=i.id AND sp.invoice_payment_id IS NULL),0) sales_paid,
         COALESCE((SELECT SUM(cn.total) FROM invoice_credit_notes cn WHERE cn.invoice_id=i.id),0) credit_amount
         FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE ${clause} ORDER BY i.invoice_date DESC,i.id DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit, offset: (page - 1) * limit })
      .map((i) => {
        const invoice = {
          ...i,
          sales: db
          .prepare(
            `SELECT s.id,s.sale_number,s.document_type,s.sale_date,s.total FROM invoice_sales x JOIN sales s ON s.id=x.sale_id WHERE x.invoice_id=? ORDER BY s.sale_date,s.id`,
          )
          .all(i.id),
          paid_amount: money(Number(i.sales_paid) + Number(i.new_paid)),
          credit_amount: money(Number(i.credit_amount)),
          balance_due: Math.max(
          0,
          money(Number(i.total) - Number(i.credit_amount) - Number(i.sales_paid) - Number(i.new_paid)),
          ),
        };
        invoice.overpaid_amount = Math.max(
          0,
          money(
            invoice.paid_amount + invoice.credit_amount - Number(invoice.total),
          ),
        );
        invoice.payment_status =
          invoice.balance_due <= 0
            ? "PAID"
            : invoice.paid_amount > 0 || invoice.credit_amount > 0
              ? "PARTIALLY_PAID"
              : "UNPAID";
        return invoice;
      });
  items.forEach((invoice) => {
    invoice.sale_numbers = invoice.sales
      .map((sale) => sale.sale_number)
      .join(", ");
  });
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
module.exports = {
  InvoiceError,
  detail,
  context,
  eligibleSales,
  createForSales,
  addPayment,
  update,
  nextNumberPreview,
  list,
};
