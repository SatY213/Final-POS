const db = require("../config/database");
const Settings = require("./settings.service");
const CustomerAccount = require("./customer-account.service");
const SalePayment = require("./sale-payment.service");

class PosError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const money = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// A later sale correction must preserve the cash already received. Any excess
// is held as a customer credit, while an existing debt is brought down to the
// newly calculated remaining amount.
function syncEditedSaleAccount(sale, customerId, total, userId) {
  const entries = db.prepare(
    "SELECT id,entry_type,customer_id,amount,reference FROM customer_account_entries WHERE sale_id=?",
  ).all(sale.id);
  if (entries.length && Number(customerId || 0) !== Number(sale.customer_id || 0))
    throw new PosError("The customer cannot be changed while this sale has account entries", 409);
  const paid = money(db.prepare(
    "SELECT COALESCE(SUM(amount),0) amount FROM sale_payments WHERE sale_id=?",
  ).get(sale.id).amount);
  const creditUsage = entries.find((entry) => entry.entry_type === "CREDIT_USAGE");
  const usableCredit = Math.min(money(creditUsage?.amount || 0), Math.max(0, money(total - paid)));
  if (creditUsage && usableCredit > 0)
    CustomerAccount.addEntry({ customerId, entryType: "CREDIT_USAGE", amount: usableCredit, saleId: sale.id, reference: sale.sale_number, description: "Utilisation du solde client", userId });
  else if (creditUsage)
    db.prepare("DELETE FROM customer_account_entries WHERE id=?").run(creditUsage.id);
  const balanceDue = Math.max(0, money(total - paid - usableCredit));
  const overpayment = Math.max(0, money(paid - total));
  if ((balanceDue > 0 || overpayment > 0) && !customerId)
    throw new PosError("A customer is required to keep the balance of an edited sale", 409);
  const saleCredit = entries.find((entry) => entry.entry_type === "SALE_CREDIT");
  if (balanceDue > 0)
    CustomerAccount.addEntry({ customerId, entryType: "SALE_CREDIT", amount: balanceDue, saleId: sale.id, reference: sale.sale_number, description: "Vente à crédit ajustée", userId });
  else if (saleCredit)
    db.prepare("DELETE FROM customer_account_entries WHERE id=?").run(saleCredit.id);
  const creditReference = `SALE_OVERPAYMENT:${sale.id}`;
  const overpaymentEntry = entries.find((entry) => entry.entry_type === "ADJUSTMENT" && entry.reference === creditReference);
  if (overpayment > 0) {
    if (overpaymentEntry)
      db.prepare("UPDATE customer_account_entries SET customer_id=?,amount=?,description=?,created_by=? WHERE id=?").run(customerId, -overpayment, "Crédit issu de la modification de vente", userId, overpaymentEntry.id);
    else
      CustomerAccount.addEntry({ customerId, entryType: "ADJUSTMENT", amount: -overpayment, saleId: sale.id, reference: creditReference, description: "Crédit issu de la modification de vente", userId });
  } else if (overpaymentEntry)
    db.prepare("DELETE FROM customer_account_entries WHERE id=?").run(overpaymentEntry.id);
  return SalePayment.paymentSummary(sale.id, total).payment_status;
}
const positive = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0)
    throw new PosError(`${label} must be greater than zero`);
  return number;
};
function authorizeWarehouse(id, user) {
  if (user.role === "stock")
    throw new PosError("Stock users cannot finalize sales", 403);
  const warehouse = db
    .prepare("SELECT id,name,is_active,can_sell FROM warehouses WHERE id=?")
    .get(Number(id));
  if (!warehouse || !warehouse.is_active || !warehouse.can_sell)
    throw new PosError("The selected warehouse cannot make sales", 403);
  if (
    user.role !== "admin" &&
    (user.warehouse_ids?.length
      ? !user.warehouse_ids.map(Number).includes(warehouse.id)
      : user.warehouse_id != null && Number(user.warehouse_id) !== warehouse.id)
  )
    throw new PosError("You cannot sell from another warehouse", 403);
  return warehouse;
}
function currentSession(user, warehouseId) {
  return (
    db
      .prepare(
        `SELECT cs.id,cs.cash_register_id,cr.name cash_register_name,cr.warehouse_id
    FROM cash_sessions cs JOIN cash_registers cr ON cr.id=cs.cash_register_id
    WHERE cs.user_id=? AND cs.status='open' AND cr.warehouse_id=?`,
      )
      .get(user.id, warehouseId) || null
  );
}
function context(user, warehouseId) {
  const warehouse = authorizeWarehouse(warehouseId, user),
    sales = Settings.getGroup("sales"),
    payments = Settings.getGroup("payments"),
    cash = Settings.getGroup("cash"),
    expiration = Settings.getGroup("expiration"),
    printing = Settings.getGroup("printing");
  let customer =
    sales.default_customer_id == null
      ? null
      : db
          .prepare(
            `SELECT id,name,phone,
              opening_balance + COALESCE((SELECT SUM(amount) FROM customer_account_entries WHERE customer_id=customers.id),0) account_balance
             FROM customers WHERE id=? AND is_active=1`,
          )
          .get(sales.default_customer_id) || null;
  const paymentMethods = Settings.paymentMethods().filter(
    (item) => item.is_active && item.code !== "CUSTOMER_CREDIT",
  );
  return {
    warehouse,
    cash_session: currentSession(user, warehouse.id),
    settings: { sales, payments, cash, expiration, printing },
    default_customer: customer,
    payment_methods: paymentMethods,
    numbering_preview: Settings.numberingPreview(),
    print_profiles: Settings.profiles().filter((item) => item.is_active),
    permissions: {
      can_backdate_sale: ["admin", "manager"].includes(user.role),
    },
  };
}
function searchProducts(query, warehouseId, user) {
  authorizeWarehouse(warehouseId, user);
  const search = String(query || "").trim();
  if (!search) return [];
  return db
    .prepare(
      `SELECT p.id product_id,p.designation,p.reference,p.track_stock,p.track_batches,p.track_expiration,p.track_serials,
    pu.id product_unit_id,pu.conversion_factor,pu.selling_price,u.name unit_name,u.symbol unit_symbol,p.min_stock,
    pb.barcode,CASE WHEN pb.barcode=@exact THEN 1 ELSE 0 END exact_match,
    COALESCE(ps.quantity,0) stock_quantity,(SELECT MIN(sb.expiration_date) FROM stock_batches sb WHERE sb.product_id=p.id AND sb.warehouse_id=@warehouse AND sb.quantity>0) nearest_expiration
    FROM products p JOIN product_units pu ON pu.product_id=p.id AND pu.is_active=1 JOIN units u ON u.id=pu.unit_id
    LEFT JOIN product_barcodes pb ON pb.product_unit_id=pu.id
    LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=@warehouse
    WHERE p.is_active=1 AND (pb.barcode=@exact OR p.reference=@exact COLLATE NOCASE OR p.designation LIKE @like COLLATE NOCASE OR p.reference LIKE @like COLLATE NOCASE)
    ORDER BY exact_match DESC,p.designation COLLATE NOCASE,pu.is_base DESC LIMIT 30`,
    )
    .all({
      exact: search,
      like: `%${search}%`,
      warehouse: Number(warehouseId),
    });
}
function customerSearch(query) {
  const term = String(query || "").trim();
  if (!term) return [];
  const search = `%${term}%`;
  return db
    .prepare(
      `SELECT id,name,phone,email,nif,
        opening_balance + COALESCE((SELECT SUM(amount) FROM customer_account_entries WHERE customer_id=customers.id),0) account_balance
       FROM customers
       WHERE is_active=1 AND (name LIKE ? COLLATE NOCASE OR phone LIKE ? OR email LIKE ? COLLATE NOCASE OR nif LIKE ? COLLATE NOCASE)
       ORDER BY name COLLATE NOCASE LIMIT 20`,
    )
    .all(search, search, search, search);
}
function productUnits(productId) {
  return db
    .prepare(
      `SELECT pu.id product_unit_id,pu.product_id,pu.conversion_factor,pu.selling_price,u.name unit_name,u.symbol unit_symbol,(SELECT barcode FROM product_barcodes pb WHERE pb.product_unit_id=pu.id ORDER BY pb.is_primary DESC,pb.id LIMIT 1) barcode FROM product_units pu JOIN products p ON p.id=pu.product_id AND p.is_active=1 JOIN units u ON u.id=pu.unit_id WHERE pu.product_id=? AND pu.is_active=1 ORDER BY pu.is_base DESC,pu.conversion_factor`,
    )
    .all(Number(productId));
}
function availableSerials(productId, warehouseId, user) {
  authorizeWarehouse(warehouseId, user);
  const product = db
    .prepare("SELECT id,track_serials FROM products WHERE id=? AND is_active=1")
    .get(Number(productId));
  if (!product || !product.track_serials)
    throw new PosError("This product is not tracked by serial number", 409);
  return db
    .prepare(
      "SELECT id,serial_number,received_at FROM stock_serials WHERE product_id=? AND warehouse_id=? AND status='AVAILABLE' ORDER BY received_at,id",
    )
    .all(product.id, Number(warehouseId));
}
const addAvailableSerial = db.transaction((productId, warehouseId, serialNumber, user) => {
  authorizeWarehouse(warehouseId, user);
  const product = db
    .prepare("SELECT id,track_serials FROM products WHERE id=? AND is_active=1")
    .get(Number(productId));
  if (!product || !product.track_serials)
    throw new PosError("This product is not tracked by serial number", 409);
  const value = String(serialNumber || "").trim();
  if (!value) throw new PosError("Serial number is required");
  const stock = Number(
      db.prepare("SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?").get(product.id, Number(warehouseId))?.quantity || 0,
    ),
    registered = Number(
      db.prepare("SELECT COUNT(*) count FROM stock_serials WHERE product_id=? AND warehouse_id=? AND status='AVAILABLE'").get(product.id, Number(warehouseId)).count,
    );
  if (registered >= Math.floor(stock + 1e-9))
    throw new PosError("All units in stock already have a serial number", 409);
  try {
    const id = Number(
      db.prepare("INSERT INTO stock_serials(product_id,warehouse_id,serial_number,status) VALUES(?,?,?,'AVAILABLE')").run(product.id, Number(warehouseId), value).lastInsertRowid,
    );
    return db.prepare("SELECT id,serial_number,received_at FROM stock_serials WHERE id=?").get(id);
  } catch (error) {
    if (String(error.code).includes("SQLITE_CONSTRAINT"))
      throw new PosError("A serial number already exists", 409);
    throw error;
  }
});
function calculateLines(inputLines, settings, options = {}) {
  if (!Array.isArray(inputLines) || !inputLines.length)
    throw new PosError("Add at least one item to the sale");
  const historicalLines = new Map(
    (options.historicalLines || []).map((line) => [Number(line.id), line]),
  );
  return inputLines.map((input) => {
    const type = ["PRODUCT", "SERVICE", "MISC"].includes(input.line_type)
      ? input.line_type
      : "PRODUCT";
    const quantity = positive(input.quantity, "Quantity");
    let snapshot;
    if (type === "PRODUCT") {
      snapshot = db
        .prepare(
          `SELECT p.id product_id,p.designation,p.reference,p.track_stock,p.track_batches,p.track_expiration,p.track_serials,
        pu.id product_unit_id,pu.conversion_factor,pu.selling_price,u.name unit_name,
        (SELECT barcode FROM product_barcodes pb WHERE pb.product_unit_id=pu.id ORDER BY pb.is_primary DESC,pb.id LIMIT 1) barcode
        FROM products p JOIN product_units pu ON pu.product_id=p.id AND pu.id=? AND pu.is_active=1 JOIN units u ON u.id=pu.unit_id WHERE p.id=? AND p.is_active=1`,
        )
        .get(Number(input.product_unit_id), Number(input.product_id));
      if (!snapshot)
        throw new PosError(
          "A selected product or packaging is no longer available",
        );
    } else
      snapshot = {
        designation: String(input.designation || "").trim(),
        reference: null,
        barcode: null,
        unit_name: String(input.unit_name || "Unit"),
        conversion_factor: 1,
        selling_price: Number(input.unit_price),
        track_stock: 0,
        track_batches: 0,
        track_expiration: 0,
        track_serials: 0,
        product_id: null,
        product_unit_id: null,
      };
    if (!snapshot.designation)
      throw new PosError("Line designation is required");
    let unitPrice = Number(input.unit_price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0)
      throw new PosError(`Invalid price for ${snapshot.designation}`);
    const historical = historicalLines.get(Number(input.id));
    const keepsHistoricalPrice =
      historical &&
      Number(historical.product_id || 0) === Number(snapshot.product_id || 0) &&
      Number(historical.product_unit_id || 0) ===
        Number(snapshot.product_unit_id || 0) &&
      money(unitPrice) === money(historical.unit_price);
    if (
      type === "PRODUCT" &&
      money(unitPrice) !== money(snapshot.selling_price) &&
      !settings.allow_price_edit &&
      !keepsHistoricalPrice
    )
      throw new PosError(
        `Price editing is not allowed for ${snapshot.designation}`,
        403,
      );
    const discountType = input.discount_type === "FIXED" ? "FIXED" : "PERCENT",
      discountValue = Number(
        input.discount_value ?? input.discount_percent ?? 0,
      ),
      subtotal = money(quantity * unitPrice),
      maxDiscountAmount = money(
        (subtotal * settings.max_discount_percent) / 100,
      ),
      discountAmount =
        discountType === "FIXED"
          ? money(discountValue)
          : money((subtotal * discountValue) / 100),
      discount = subtotal ? money((discountAmount / subtotal) * 100) : 0;
    const keepsHistoricalDiscount =
      historical &&
      (historical.discount_type === "FIXED" ? "FIXED" : "PERCENT") ===
        discountType &&
      money(historical.discount_value) === money(discountValue);
    if (
      !Number.isFinite(discountValue) ||
      discountValue < 0 ||
      discountAmount > subtotal ||
      (discountAmount > 0 && !settings.allow_discount &&
        !keepsHistoricalDiscount) ||
      (discountAmount > maxDiscountAmount && !keepsHistoricalDiscount)
    )
      throw new PosError(
        `Discount exceeds the allowed limit of ${settings.max_discount_percent}%`,
      );
    const net = money(subtotal - discountAmount);
    return {
      ...snapshot,
      line_type: type,
      quantity,
      unit_price: money(unitPrice),
      discount_percent: discount,
      discount_type: discountType,
      discount_value: money(discountValue),
      discount_amount: discountAmount,
      subtotal,
      total: net,
      base_quantity: snapshot.track_stock
        ? quantity * Number(snapshot.conversion_factor)
        : null,
      serial_ids: Array.isArray(input.serial_ids)
        ? input.serial_ids.map(Number).filter(Number.isInteger)
        : [],
      batch_id: input.batch_id != null && Number.isInteger(Number(input.batch_id))
        ? Number(input.batch_id)
        : null,
    };
  });
}
function totals(lines, globalInput, settings) {
  const input =
      typeof globalInput === "object" && globalInput
        ? globalInput
        : { type: "PERCENT", value: globalInput },
    globalType = input.type === "FIXED" ? "FIXED" : "PERCENT",
    globalValue = Number(input.value || 0);
  if (!Number.isFinite(globalValue) || globalValue < 0)
    throw new PosError(
      `Global discount exceeds the allowed limit of ${settings.max_discount_percent}%`,
    );
  const subtotal = money(lines.reduce((sum, line) => sum + line.subtotal, 0)),
    lineDiscount = money(
      lines.reduce((sum, line) => sum + line.discount_amount, 0),
    );
  const netBeforeGlobal = money(
      lines.reduce(
        (sum, line) => sum + line.subtotal - line.discount_amount,
        0,
      ),
    ),
    globalAmount =
      globalType === "FIXED"
        ? money(globalValue)
        : money((netBeforeGlobal * globalValue) / 100),
    maxGlobalAmount = money(
      (netBeforeGlobal * settings.max_discount_percent) / 100,
    );
  if (
    globalAmount > netBeforeGlobal ||
    globalAmount > maxGlobalAmount ||
    (globalAmount > 0 && !settings.allow_discount)
  )
    throw new PosError(
      `Global discount exceeds the allowed limit of ${settings.max_discount_percent}%`,
    );
  const globalPercent = netBeforeGlobal
    ? money((globalAmount / netBeforeGlobal) * 100)
    : 0;
  return {
    subtotal,
    line_discount_total: lineDiscount,
    global_discount_percent: globalPercent,
    global_discount_type: globalType,
    global_discount_value: money(globalValue),
    global_discount_amount: globalAmount,
    total: money(netBeforeGlobal - globalAmount),
  };
}
function allocateNumber(warehouseId) {
  return Settings.nextDocumentNumber("SALE", warehouseId);
}
function insertLines(saleId, lines) {
  const insert = db.prepare(
    `INSERT INTO sale_lines(sale_id,line_type,product_id,product_unit_id,designation,reference,barcode,unit_name,conversion_factor,quantity,base_quantity,unit_price,discount_percent,discount_type,discount_value,discount_amount,subtotal,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  return lines.map((line) => ({
    ...line,
    id: Number(
      insert.run(
        saleId,
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
      ).lastInsertRowid,
    ),
  }));
}
function synchronizeSourceQuote(quote, data, lines, summary) {
  db.prepare("DELETE FROM quote_lines WHERE quote_id=?").run(quote.id);
  const insert = db.prepare(
    `INSERT INTO quote_lines(quote_id,line_type,product_id,product_unit_id,designation,reference,barcode,unit_name,conversion_factor,quantity,base_quantity,unit_price,discount_percent,discount_type,discount_value,discount_amount,subtotal,total)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  lines.forEach((line) =>
    insert.run(
      quote.id,
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
  db.prepare(
    `UPDATE quotes SET subtotal=?,line_discount_total=?,global_discount_type=?,
       global_discount_value=?,global_discount_amount=?,total=?,note=?,
       customer_reference=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
  ).run(
    summary.subtotal,
    summary.line_discount_total,
    summary.global_discount_type,
    summary.global_discount_value,
    summary.global_discount_amount,
    summary.total,
    String(data.note || "").trim() || null,
    String(data.customer_reference || "").trim() || null,
    quote.id,
  );
}
function saleDate(value, user) {
  const today = new Date().toISOString().slice(0, 10),
    date = String(value || today);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()) ||
    date > today
  )
    throw new PosError("Sale date is invalid");
  if (date !== today && !["admin", "manager"].includes(user.role))
    throw new PosError("Backdating sales is not allowed for this user", 403);
  return date;
}
function applyStock(line, saleId, saleLineId, warehouseId, user, settings) {
  if (!line.track_stock) return;
  const stock = Number(
    db
      .prepare(
        "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
      )
      .get(line.product_id, warehouseId)?.quantity || 0,
  );
  if (stock < line.base_quantity && !settings.sales.allow_negative_stock)
    throw new PosError(`Insufficient stock for ${line.designation}`, 409);
  if (line.track_serials) {
    if (!Number.isInteger(line.base_quantity))
      throw new PosError(
        `Serialized quantity must be a whole number for ${line.designation}`,
        409,
      );
    const selectedIds = [...new Set(line.serial_ids || [])];
    if (selectedIds.length !== line.base_quantity)
      throw new PosError(
        `Select one serial number for each unit of ${line.designation}`,
        409,
      );
    const placeholders = selectedIds.map(() => "?").join(",");
    const serials = db
      .prepare(
        `SELECT id FROM stock_serials WHERE product_id=? AND warehouse_id=? AND status='AVAILABLE' AND id IN (${placeholders})`,
      )
      .all(line.product_id, warehouseId, ...selectedIds);
    if (serials.length !== line.base_quantity)
      throw new PosError(
        `Not enough available serial numbers for ${line.designation}`,
        409,
      );
    const mark = db.prepare(
        "UPDATE stock_serials SET status='SOLD',sold_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='AVAILABLE'",
      ),
      allocate = db.prepare(
        "INSERT INTO sale_serial_allocations(sale_line_id,serial_id) VALUES(?,?)",
      );
    serials.forEach((serial) => {
      if (mark.run(serial.id).changes !== 1)
        throw new PosError("Serial allocation conflict", 409);
      allocate.run(saleLineId, serial.id);
    });
  }
  if (line.track_batches) {
    const batches = db
      .prepare(
        `SELECT id,quantity,expiration_date FROM stock_batches WHERE product_id=? AND warehouse_id=? AND quantity>0 AND (? IS NULL OR id=?) ORDER BY CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,expiration_date,received_at,id`,
      )
      .all(line.product_id, warehouseId, line.batch_id, line.batch_id);
    let remaining = line.base_quantity;
    for (const batch of batches) {
      if (remaining <= 1e-9) break;
      if (
        batch.expiration_date &&
        batch.expiration_date < new Date().toISOString().slice(0, 10) &&
        settings.expiration.block_expired_sale
      )
        continue;
      const used = Math.min(remaining, Number(batch.quantity));
      db.prepare("UPDATE stock_batches SET quantity=quantity-? WHERE id=?").run(
        used,
        batch.id,
      );
      db.prepare(
        "INSERT INTO sale_batch_allocations(sale_line_id,batch_id,quantity) VALUES(?,?,?)",
      ).run(saleLineId, batch.id, used);
      db.prepare(
        "INSERT INTO stock_movements(product_id,warehouse_id,batch_id,type,quantity,reference_type,reference_id,created_by) VALUES(?,?,?,'SALE',?,'SALE',?,?)",
      ).run(
        line.product_id,
        warehouseId,
        batch.id,
        -used,
        String(saleId),
        user.id,
      );
      remaining -= used;
    }
    if (remaining > 1e-9 && !settings.sales.allow_negative_stock)
      throw new PosError(`No valid batch stock for ${line.designation}`, 409);
    if (remaining > 1e-9)
      db.prepare(
        "INSERT INTO stock_movements(product_id,warehouse_id,type,quantity,reference_type,reference_id,created_by) VALUES(?,?,'SALE',?,'SALE',?,?)",
      ).run(line.product_id, warehouseId, -remaining, String(saleId), user.id);
  } else
    db.prepare(
      "INSERT INTO stock_movements(product_id,warehouse_id,type,quantity,reference_type,reference_id,created_by) VALUES(?,?,'SALE',?,'SALE',?,?)",
    ).run(
      line.product_id,
      warehouseId,
      -line.base_quantity,
      String(saleId),
      user.id,
    );
  db.prepare(
    "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,?) ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=quantity+excluded.quantity",
  ).run(line.product_id, warehouseId, -line.base_quantity);
}
function validatePayments(
  input,
  total,
  settings,
  user,
  warehouseId,
  options = {},
) {
  if (!Array.isArray(input) || !input.length) {
    if (options.allowEmpty) return [];
    throw new PosError("Add a payment method");
  }
  if (input.length > 1)
    throw new PosError("Only one payment method is allowed at checkout");
  const paymentTotal = money(options.maximum ?? total);
  const payment = input[0],
    method = db
      .prepare("SELECT * FROM payment_methods WHERE code=? AND is_active=1")
      .get(payment.code);
  if (!method || method.code === "CUSTOMER_CREDIT")
    throw new PosError("A payment method is unavailable");
  let amount, received, change;
  if (method.allows_change) {
    received = Number(payment.amount_received ?? payment.amount);
    if (!Number.isFinite(received) || received < 0)
      throw new PosError("Amount received is invalid");
    amount = money(Math.min(received, paymentTotal));
    change = money(Math.max(0, received - paymentTotal));
  } else {
    amount = money(positive(payment.amount, "Payment amount"));
    received = amount;
    change = 0;
  }
  if (amount <= 0) {
    if (options.allowEmpty) return [];
    throw new PosError("Payment amount must be greater than zero");
  }
  if (amount - paymentTotal > 0.001)
    throw new PosError("Payment exceeds the sale total");
  if (!options.allowPartial && amount !== paymentTotal)
    throw new PosError(
      `Payment remaining amount is ${money(paymentTotal - amount)} DA`,
    );
  const session = currentSession(user, warehouseId);
  // A cash payment and a cash movement are one atomic operation.  Allowing a
  // payment without its session would make the customer balance disagree with
  // the physical drawer, even when the optional POS setting is disabled.
  if (method.affects_cash_drawer && !session)
    throw new PosError(
      "An open cash session is required for cash payment",
      409,
    );
  return [
    {
      method,
      amount,
      amount_received: money(received),
      change_amount: change,
      reference: String(payment.reference || "").trim() || null,
      session,
    },
  ];
}
function hydrateSale(id) {
  const sale = db
    .prepare(
      `SELECT s.*,w.name warehouse_name,w.phone warehouse_phone,w.email warehouse_email,w.address warehouse_address,w.nif warehouse_nif,w.nis warehouse_nis,w.rib warehouse_rib,w.tax_article warehouse_tax_article,w.commercial_register warehouse_commercial_register,w.business_activity warehouse_business_activity,c.name customer_name,c.phone customer_phone,c.email customer_email,c.address customer_address,c.nif customer_nif,c.nis customer_nis,c.rib customer_rib,c.tax_article customer_tax_article,c.commercial_register customer_commercial_register,c.business_activity customer_business_activity,cr.name cash_register_name,u.name created_by_name,u.name seller_name FROM sales s JOIN warehouses w ON w.id=s.warehouse_id LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN cash_registers cr ON cr.id=s.cash_register_id JOIN users u ON u.id=s.created_by WHERE s.id=?`,
    )
    .get(id);
  if (!sale) return null;
  sale.lines = db
    .prepare(
      `SELECT sl.*,COALESCE(p.track_stock,0) track_stock,
       COALESCE(p.track_batches,0) track_batches,
       COALESCE(p.track_expiration,0) track_expiration,
       COALESCE(p.track_serials,0) track_serials,
       COALESCE(ps.quantity,0) stock_quantity,p.min_stock
       FROM sale_lines sl
       LEFT JOIN products p ON p.id=sl.product_id
       LEFT JOIN product_stock ps ON ps.product_id=sl.product_id AND ps.warehouse_id=?
       WHERE sl.sale_id=? ORDER BY sl.id`,
    )
    .all(sale.warehouse_id, id)
    .map((line) => {
      const serials = db
        .prepare(
          `SELECT ss.id,ss.serial_number
           FROM sale_serial_allocations a
           JOIN stock_serials ss ON ss.id=a.serial_id
           WHERE a.sale_line_id=? ORDER BY a.id`,
        )
        .all(line.id);
      const batches = db
        .prepare(
          `SELECT a.batch_id,a.quantity,b.batch_number,b.expiration_date
           FROM sale_batch_allocations a
           JOIN stock_batches b ON b.id=a.batch_id
           WHERE a.sale_line_id=? ORDER BY a.id`,
        )
        .all(line.id);
      return {
        ...line,
        serial_ids: serials.map((serial) => serial.id),
        serial_numbers: serials.map((serial) => serial.serial_number),
        batch_allocations: batches,
        batch_id: batches.length === 1 ? batches[0].batch_id : null,
        batch_number: batches.length === 1 ? batches[0].batch_number : null,
      };
    });
  sale.payments = db
    .prepare(
      "SELECT sp.*,pm.name payment_method_name FROM sale_payments sp JOIN payment_methods pm ON pm.code=sp.payment_method_code WHERE sp.sale_id=? ORDER BY sp.id",
    )
    .all(id);
  sale.deliveries = db
    .prepare(
      "SELECT id,status,delivery_date,prepared_at,shipped_at,delivered_at FROM deliveries WHERE sale_id=? ORDER BY id",
    )
    .all(id);
  sale.document_number = sale.sale_number;
  sale.sale_date = sale.sale_date || String(sale.completed_at || sale.created_at || "").slice(0, 10);
  sale.payment_summary = SalePayment.paymentSummary(sale.id, sale.total);
  sale.customer_credit_amount = CustomerAccount.money(
    db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) amount FROM customer_account_entries WHERE sale_id=? AND entry_type='SALE_CREDIT'",
      )
      .get(sale.id).amount,
  );
  return sale;
}
const finalize = db.transaction((data, user) => {
  if (!data.client_request_id)
    throw new PosError("Sale request identifier is required");
  const duplicate = db
    .prepare(
      "SELECT id FROM sales WHERE client_request_id=? AND sale_status='CONFIRMED'",
    )
    .get(data.client_request_id);
  if (duplicate) return hydrateSale(duplicate.id);
  const warehouse = authorizeWarehouse(data.warehouse_id, user),
    settings = {
      sales: Settings.getGroup("sales"),
      payments: Settings.getGroup("payments"),
      cash: Settings.getGroup("cash"),
      expiration: Settings.getGroup("expiration"),
    };
  const fulfillmentType =
    data.fulfillment_type === "SHIPPING" ? "SHIPPING" : "IMMEDIATE";
  const requiresDelivery = fulfillmentType === "SHIPPING";
  let customer =
    data.customer_id == null
      ? null
      : db
          .prepare("SELECT id,name FROM customers WHERE id=? AND is_active=1")
          .get(Number(data.customer_id));
  if (data.customer_id && !customer)
    throw new PosError("The selected customer is inactive");
  if (!customer && !settings.sales.allow_default_customer)
    throw new PosError("Veuillez sélectionner un client pour cette vente.");
  let sourceQuote = null;
  if (data.source_quote_id) {
    sourceQuote = db
      .prepare("SELECT * FROM quotes WHERE id=?")
      .get(Number(data.source_quote_id));
    if (
      !sourceQuote ||
      ["CONVERTED", "CANCELLED"].includes(sourceQuote.status) ||
      Number(sourceQuote.warehouse_id) !== Number(warehouse.id) ||
      Number(sourceQuote.customer_id) !== Number(customer?.id)
    )
      throw new PosError("Source quote is unavailable", 409);
    sourceQuote.lines = db
      .prepare(
        `SELECT ql.*,COALESCE(p.track_stock,0) track_stock,COALESCE(p.track_batches,0) track_batches,COALESCE(p.track_expiration,0) track_expiration,COALESCE(p.track_serials,0) track_serials FROM quote_lines ql LEFT JOIN products p ON p.id=ql.product_id WHERE ql.quote_id=? ORDER BY ql.id`,
      )
      .all(sourceQuote.id);
  }
  const lines = calculateLines(data.lines, settings.sales, {
      historicalLines: sourceQuote?.lines,
    }),
    summary = totals(
      lines,
      {
        type: data.global_discount_type,
        value: data.global_discount_value ?? data.global_discount_percent,
      },
      settings.sales,
    ),
    businessDate = saleDate(data.sale_date, user);
  const payments = validatePayments(
    data.payments || [],
    summary.total,
    settings,
    user,
    warehouse.id,
    {
      allowEmpty: true,
      allowPartial: true,
      maximum: money(summary.total - Number(data.customer_credit_used || 0)),
    },
  );
  const realPaid = money(payments.reduce((sum, row) => sum + row.amount, 0));
  const requestedCreditUsage = money(data.customer_credit_used || 0);
  const selectedCustomer = data.customer_id ? customer : null;
  if (requestedCreditUsage < 0)
    throw new PosError("Customer credit usage cannot be negative");
  if (requestedCreditUsage > 0 && !selectedCustomer)
    throw new PosError(
      "Veuillez sélectionner un client pour utiliser son solde.",
    );
  const availableCredit = selectedCustomer
    ? CustomerAccount.summary(selectedCustomer.id).available_credit
    : 0;
  if (requestedCreditUsage - availableCredit > 0.001)
    throw new PosError("Le solde client disponible est insuffisant.");
  if (realPaid + requestedCreditUsage - summary.total > 0.001)
    throw new PosError("Payment exceeds the sale total");
  const balanceDue = Math.max(
    0,
    money(summary.total - realPaid - requestedCreditUsage),
  );
  const leaveOnCredit = data.leave_unpaid === true;
  if (leaveOnCredit && !selectedCustomer)
    throw new PosError(
      "Veuillez sélectionner un client pour effectuer une vente à crédit.",
    );
  if (balanceDue > 0.001 && !leaveOnCredit)
    throw new PosError(`Payment remaining amount is ${balanceDue} DA`);
  if (sourceQuote)
    synchronizeSourceQuote(sourceQuote, data, lines, summary);
  const session = currentSession(user, warehouse.id);
  const documentType = fulfillmentType === "SHIPPING" ? "DELIVERY_NOTE" : (data.document_type === "BON_POUR" ? "BON_POUR" : "TICKET");
  let saleId;
  if (data.suspended_sale_id) {
    const draft = db
      .prepare(
        "SELECT id FROM sales WHERE id=? AND sale_status='DRAFT' AND created_by=?",
      )
      .get(data.suspended_sale_id, user.id);
    if (!draft) throw new PosError("Suspended sale is unavailable", 404);
    db.prepare("DELETE FROM sale_lines WHERE sale_id=?").run(draft.id);
    saleId = draft.id;
    db.prepare(
      `UPDATE sales SET client_request_id=@request,customer_id=@customer,cash_register_id=@register,cash_session_id=@session,sale_number=@number,document_type=@documentType,fulfillment_type=@fulfillment,sale_status='CONFIRMED',sale_date=@date,subtotal=@subtotal,line_discount_total=@lineDiscount,global_discount_percent=@globalPercent,global_discount_type=@globalType,global_discount_value=@globalValue,global_discount_amount=@globalAmount,total=@total,note=@note,customer_reference=@customerReference,payment_status=@paymentStatus,return_status='NOT_RETURNED',source_quote_id=@sourceQuote,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=@id`,
    ).run({
      request: data.client_request_id,
      customer: customer?.id || null,
      register: session?.cash_register_id || null,
      session: session?.id || null,
      number: allocateNumber(warehouse.id),
      documentType,
      fulfillment: fulfillmentType,
      date: businessDate,
      subtotal: summary.subtotal,
      lineDiscount: summary.line_discount_total,
      globalPercent: summary.global_discount_percent,
      globalType: summary.global_discount_type,
      globalValue: summary.global_discount_value,
      globalAmount: summary.global_discount_amount,
      total: summary.total,
      note: String(data.note || "").trim() || null,
      customerReference: String(data.customer_reference || "").trim() || null,
      paymentStatus:
        balanceDue <= 0
          ? "PAID"
          : realPaid > 0 || requestedCreditUsage > 0
            ? "PARTIALLY_PAID"
            : "UNPAID",
      sourceQuote: data.source_quote_id || null,
      id: draft.id,
    });
  } else
    saleId = Number(
      db
        .prepare(
          `INSERT INTO sales(client_request_id,warehouse_id,cash_register_id,cash_session_id,customer_id,sale_number,document_type,fulfillment_type,sale_status,sale_date,subtotal,line_discount_total,global_discount_percent,global_discount_type,global_discount_value,global_discount_amount,total,note,customer_reference,payment_status,return_status,source_quote_id,created_by,completed_at) VALUES(@request,@warehouse,@register,@session,@customer,@number,@documentType,@fulfillment,'CONFIRMED',@date,@subtotal,@lineDiscount,@globalPercent,@globalType,@globalValue,@globalAmount,@total,@note,@customerReference,@paymentStatus,'NOT_RETURNED',@sourceQuote,@user,CURRENT_TIMESTAMP)`,
        )
        .run({
          request: data.client_request_id,
          warehouse: warehouse.id,
          register: session?.cash_register_id || null,
          session: session?.id || null,
          customer: customer?.id || null,
          number: allocateNumber(warehouse.id),
          documentType,
          fulfillment: fulfillmentType,
          date: businessDate,
          subtotal: summary.subtotal,
          lineDiscount: summary.line_discount_total,
          globalPercent: summary.global_discount_percent,
          globalType: summary.global_discount_type,
          globalValue: summary.global_discount_value,
          globalAmount: summary.global_discount_amount,
          total: summary.total,
          note: String(data.note || "").trim() || null,
          customerReference:
            String(data.customer_reference || "").trim() || null,
          paymentStatus:
            balanceDue <= 0
              ? "PAID"
              : realPaid > 0 || requestedCreditUsage > 0
                ? "PARTIALLY_PAID"
                : "UNPAID",
          sourceQuote: data.source_quote_id || null,
          user: user.id,
        }).lastInsertRowid,
    );
  const savedLines = insertLines(saleId, lines);
  if (!requiresDelivery)
    savedLines.forEach((line) =>
      applyStock(line, saleId, line.id, warehouse.id, user, settings),
    );
  const paymentInsert = db.prepare(
    "INSERT INTO sale_payments(sale_id,payment_method_code,amount,amount_received,change_amount,reference,cash_session_id,created_by) VALUES(?,?,?,?,?,?,?,?)",
  );
  payments.forEach((p) => {
    paymentInsert.run(
      saleId,
      p.method.code,
      p.amount,
      p.amount_received,
      p.change_amount,
      p.reference,
      p.method.affects_cash_drawer ? p.session?.id : null,
      user.id,
    );
    if (p.method.affects_cash_drawer)
      db.prepare(
        "INSERT INTO cash_movements(cash_session_id,direction,movement_type,amount,reference_type,reference_id,note,created_by) VALUES(?,'IN','SALE_PAYMENT',?,'SALE',?,?,?)",
      ).run(p.session.id, p.amount, saleId, `Sale ${saleId}`, user.id);
  });
  if (requestedCreditUsage > 0)
    CustomerAccount.addEntry({
      customerId: selectedCustomer.id,
      entryType: "CREDIT_USAGE",
      amount: requestedCreditUsage,
      saleId,
      reference: `SALE:${saleId}`,
      description: "Utilisation du solde client",
      userId: user.id,
    });
  if (balanceDue > 0)
    CustomerAccount.addEntry({
      customerId: selectedCustomer.id,
      entryType: "SALE_CREDIT",
      amount: balanceDue,
      saleId,
      reference: `SALE:${saleId}`,
      description: "Vente à crédit",
      userId: user.id,
    });
  SalePayment.syncPaymentStatus(saleId);
  if (requiresDelivery) {
    const requestedDeliveryStatus = ["PREPARED", "SHIPPED", "DELIVERED"].includes(
      data.delivery_status,
    )
      ? data.delivery_status
      : "PREPARED";
    const deliveryId = Number(
      db
        .prepare(
          `INSERT INTO deliveries(client_request_id,sale_id,warehouse_id,customer_id,status,delivery_date,note,created_by) VALUES(?,?,?,?, 'PREPARED',?,?,?)`,
        )
        .run(
          `${data.client_request_id}:delivery`,
          saleId,
          warehouse.id,
          customer?.id || null,
          businessDate,
          String(data.delivery_note || "").trim() || null,
          user.id,
        ).lastInsertRowid,
    );
    const insertDeliveryLine = db.prepare(
      `INSERT INTO delivery_lines(delivery_id,sale_line_id,product_id,designation,unit_name,quantity,base_quantity) VALUES(?,?,?,?,?,?,?)`,
    );
    savedLines.forEach((line) =>
      insertDeliveryLine.run(
        deliveryId,
        line.id,
        line.product_id,
        line.designation,
        line.unit_name,
        line.quantity,
        line.base_quantity,
      ),
    );
    if (requestedDeliveryStatus !== "PREPARED") {
      savedLines.forEach((line) =>
        applyStock(line, saleId, line.id, warehouse.id, user, settings),
      );
      db.prepare(
        `UPDATE deliveries
         SET status=?,stock_out_at=CURRENT_TIMESTAMP,shipped_at=CURRENT_TIMESTAMP,
             delivered_at=CASE WHEN ?='DELIVERED' THEN CURRENT_TIMESTAMP ELSE NULL END,
             updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND status='PREPARED' AND stock_out_at IS NULL`,
      ).run(requestedDeliveryStatus, requestedDeliveryStatus, deliveryId);
    }
  }
  if (sourceQuote) {
    db.prepare(
      "UPDATE quotes SET status='CONVERTED',converted_sale_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(saleId, sourceQuote.id);
  }
  return hydrateSale(saleId);
});
const suspend = db.transaction((data, user) => {
  const warehouse = authorizeWarehouse(data.warehouse_id, user),
    settings = Settings.getGroup("sales"),
    lines = calculateLines(data.lines, settings),
    summary = totals(
      lines,
      {
        type: data.global_discount_type,
        value: data.global_discount_value ?? data.global_discount_percent,
      },
      settings,
    ),
    businessDate = saleDate(data.sale_date, user);
  const id = Number(
    db
      .prepare(
        `INSERT INTO sales(client_request_id,warehouse_id,customer_id,fulfillment_type,sale_status,sale_date,subtotal,line_discount_total,global_discount_percent,global_discount_type,global_discount_value,global_discount_amount,total,note,customer_reference,created_by) VALUES(?,?,?,?,'DRAFT',?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        `draft:${Date.now()}:${user.id}`,
        warehouse.id,
        data.customer_id || null,
        data.fulfillment_type === "SHIPPING" ? "SHIPPING" : "IMMEDIATE",
        businessDate,
        summary.subtotal,
        summary.line_discount_total,
        summary.global_discount_percent,
        summary.global_discount_type,
        summary.global_discount_value,
        summary.global_discount_amount,
        summary.total,
        String(data.note || "").trim() || null,
        String(data.customer_reference || "").trim() || null,
        user.id,
      ).lastInsertRowid,
  );
  insertLines(id, lines);
  return hydrateSale(id);
});
function suspended(user, warehouseId) {
  authorizeWarehouse(warehouseId, user);
  return db
    .prepare(
      "SELECT s.id,s.total,s.created_at,s.note,s.sale_date,c.name customer_name,u.name user_name,COUNT(sl.id) line_count FROM sales s LEFT JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.created_by LEFT JOIN sale_lines sl ON sl.sale_id=s.id WHERE s.sale_status='DRAFT' AND s.created_by=? AND s.warehouse_id=? GROUP BY s.id ORDER BY s.created_at DESC",
    )
    .all(user.id, warehouseId);
}
function getSale(id, user) {
  const sale = hydrateSale(id);
  if (!sale) throw new PosError("Sale not found", 404);
  if (
    user.role !== "admin" &&
    Number(user.warehouse_id) !== Number(sale.warehouse_id)
  )
    throw new PosError("Sale is unauthorized", 403);
  return sale;
}

function editMovement(productId, warehouseId, quantity, editId, sale, userId, batchId = null) {
  if (Math.abs(Number(quantity)) <= 1e-9) return;
  db.prepare(
    "INSERT INTO stock_movements(product_id,warehouse_id,batch_id,type,quantity,reference_type,reference_id,note,created_by) VALUES(?,?,?,?,?,'SALE_EDIT',?,?,?)",
  ).run(
    productId,
    warehouseId,
    batchId,
    quantity > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
    quantity,
    String(editId),
    `Modification ${sale.sale_number}`,
    userId,
  );
}

function changeEditedProductStock(productId, warehouseId, quantity) {
  if (Math.abs(Number(quantity)) <= 1e-9) return;
  db.prepare(
    "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,?) ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=quantity+excluded.quantity",
  ).run(productId, warehouseId, quantity);
}

// Rebuild only the serial allocations of this sale. Existing serials are
// accepted even though their status is SOLD; every newly selected serial must
// still be AVAILABLE. The surrounding SQLite transaction makes the release
// and re-allocation atomic.
function reconcileEditedSerials(oldLines, savedLines, sale, editId, userId) {
  const oldIds = oldLines.map((line) => Number(line.id));
  if (!oldIds.length) return;
  const placeholders = oldIds.map(() => "?").join(",");
  const oldAllocations = db
    .prepare(
      `SELECT a.sale_line_id,a.serial_id,ss.product_id
       FROM sale_serial_allocations a
       JOIN stock_serials ss ON ss.id=a.serial_id
       WHERE a.sale_line_id IN (${placeholders})`,
    )
    .all(...oldIds);
  const oldByLine = new Map();
  for (const allocation of oldAllocations) {
    const values = oldByLine.get(Number(allocation.sale_line_id)) || [];
    values.push(Number(allocation.serial_id));
    oldByLine.set(Number(allocation.sale_line_id), values);
  }
  const oldSerialIds = new Set(oldAllocations.map((row) => Number(row.serial_id)));
  const desired = [];
  for (const line of savedLines.filter((row) => row.track_serials)) {
    if (!Number.isInteger(Number(line.base_quantity)))
      throw new PosError(
        `Serialized quantity must be a whole number for ${line.designation}`,
        409,
      );
    const previous = line.input_id ? oldByLine.get(Number(line.input_id)) || [] : [];
    const requested = [...new Set((line.serial_ids || []).map(Number))];
    const serialIds = requested.length ? requested : previous;
    if (serialIds.length !== Number(line.base_quantity))
      throw new PosError(
        `Select one serial number for each unit of ${line.designation}`,
        409,
      );
    serialIds.forEach((serialId) =>
      desired.push({ serialId, lineId: Number(line.id), line }),
    );
  }
  if (new Set(desired.map((row) => row.serialId)).size !== desired.length)
    throw new PosError("Serial allocation conflict", 409);
  for (const row of desired) {
    const serial = db
      .prepare(
        "SELECT id,product_id,warehouse_id,status FROM stock_serials WHERE id=?",
      )
      .get(row.serialId);
    if (
      !serial ||
      Number(serial.product_id) !== Number(row.line.product_id) ||
      Number(serial.warehouse_id) !== Number(sale.warehouse_id) ||
      (serial.status !== "AVAILABLE" && !oldSerialIds.has(Number(serial.id)))
    )
      throw new PosError(
        `Not enough available serial numbers for ${row.line.designation}`,
        409,
      );
  }
  const desiredBySerial = new Map(
      desired.map((row) => [Number(row.serialId), Number(row.lineId)]),
    ),
    retained = new Set(
      oldAllocations
        .filter(
          (row) =>
            desiredBySerial.get(Number(row.serial_id)) ===
            Number(row.sale_line_id),
        )
        .map((row) => Number(row.serial_id)),
    ),
    releaseAllocation = db.prepare(
      "DELETE FROM sale_serial_allocations WHERE sale_line_id=? AND serial_id=?",
    ),
    releaseSerial = db.prepare(
      "UPDATE stock_serials SET status='AVAILABLE',sold_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    );
  oldAllocations
    .filter((row) => !retained.has(Number(row.serial_id)))
    .forEach((row) => {
      releaseAllocation.run(row.sale_line_id, row.serial_id);
      releaseSerial.run(row.serial_id);
    });
  const allocate = db.prepare(
      "INSERT INTO sale_serial_allocations(sale_line_id,serial_id) VALUES(?,?)",
    ),
    sell = db.prepare(
      "UPDATE stock_serials SET status='SOLD',sold_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='AVAILABLE'",
    );
  desired.filter((row) => !retained.has(row.serialId)).forEach((row) => {
    if (sell.run(row.serialId).changes !== 1)
      throw new PosError("Serial allocation conflict", 409);
    allocate.run(row.lineId, row.serialId);
  });
  const products = new Set([
    ...oldAllocations.map((row) => Number(row.product_id)),
    ...savedLines.filter((row) => row.track_serials).map((row) => Number(row.product_id)),
  ]);
  products.forEach((productId) => {
    const oldQuantity = oldAllocations.filter(
        (row) => Number(row.product_id) === productId,
      ).length,
      nextQuantity = desired.filter(
        (row) => Number(row.line.product_id) === productId,
      ).length,
      stockIn = oldQuantity - nextQuantity;
    editMovement(productId, sale.warehouse_id, stockIn, editId, sale, userId);
    changeEditedProductStock(productId, sale.warehouse_id, stockIn);
  });
}

function releaseEditedBatchAllocation(allocation, quantity, sale, editId, userId) {
  db.prepare("UPDATE stock_batches SET quantity=quantity+? WHERE id=?").run(
    quantity,
    allocation.batch_id,
  );
  editMovement(
    allocation.product_id,
    sale.warehouse_id,
    quantity,
    editId,
    sale,
    userId,
    allocation.batch_id,
  );
}

function allocateEditedBatches(line, quantity, sale, editId, userId, settings) {
  const batches = db
    .prepare(
      `SELECT id,product_id,quantity,expiration_date
       FROM stock_batches
       WHERE product_id=? AND warehouse_id=? AND quantity>0 AND (? IS NULL OR id=?)
       ORDER BY CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,expiration_date,received_at,id`,
    )
    .all(line.product_id, sale.warehouse_id, line.batch_id, line.batch_id);
  let remaining = Number(quantity);
  for (const batch of batches) {
    if (remaining <= 1e-9) break;
    if (
      batch.expiration_date &&
      batch.expiration_date < new Date().toISOString().slice(0, 10) &&
      settings.expiration.block_expired_sale
    )
      continue;
    const used = Math.min(remaining, Number(batch.quantity));
    db.prepare("UPDATE stock_batches SET quantity=quantity-? WHERE id=?").run(
      used,
      batch.id,
    );
    const existingAllocation = db
      .prepare(
        "SELECT id FROM sale_batch_allocations WHERE sale_line_id=? AND batch_id=? ORDER BY id LIMIT 1",
      )
      .get(line.id, batch.id);
    if (existingAllocation)
      db.prepare(
        "UPDATE sale_batch_allocations SET quantity=quantity+? WHERE id=?",
      ).run(used, existingAllocation.id);
    else
      db.prepare(
        "INSERT INTO sale_batch_allocations(sale_line_id,batch_id,quantity) VALUES(?,?,?)",
      ).run(line.id, batch.id, used);
    editMovement(
      line.product_id,
      sale.warehouse_id,
      -used,
      editId,
      sale,
      userId,
      batch.id,
    );
    remaining -= used;
  }
  if (remaining > 1e-9)
    throw new PosError(`No valid batch stock for ${line.designation}`, 409);
}

function reconcileEditedBatches(oldLines, savedLines, sale, editId, userId, settings) {
  const savedByInput = new Map(
    savedLines.filter((line) => line.input_id).map((line) => [Number(line.input_id), line]),
  );
  for (const oldLine of oldLines) {
    const product = oldLine.product_id
      ? db.prepare("SELECT track_batches FROM products WHERE id=?").get(oldLine.product_id)
      : null;
    if (!product?.track_batches) continue;
    const allocations = db
      .prepare(
        `SELECT a.id,a.batch_id,a.quantity,b.product_id
         FROM sale_batch_allocations a JOIN stock_batches b ON b.id=a.batch_id
         WHERE a.sale_line_id=? ORDER BY a.id`,
      )
      .all(oldLine.id);
    const next = savedByInput.get(Number(oldLine.id));
    const sameProduct = next && Number(next.product_id) === Number(oldLine.product_id);
    const wanted = sameProduct ? Number(next.base_quantity) : 0;
    let allocated = allocations.reduce((sum, row) => sum + Number(row.quantity), 0);
    if (!sameProduct || wanted + 1e-9 < allocated) {
      let release = sameProduct ? allocated - wanted : allocated;
      for (const allocation of [...allocations].reverse()) {
        if (release <= 1e-9) break;
        const amount = Math.min(release, Number(allocation.quantity));
        releaseEditedBatchAllocation(allocation, amount, sale, editId, userId);
        if (amount + 1e-9 >= Number(allocation.quantity))
          db.prepare("DELETE FROM sale_batch_allocations WHERE id=?").run(allocation.id);
        else
          db.prepare("UPDATE sale_batch_allocations SET quantity=quantity-? WHERE id=?").run(amount, allocation.id);
        allocated -= amount;
        release -= amount;
      }
    }
    if (sameProduct && wanted > allocated + 1e-9) {
      const amount = wanted - allocated;
      allocateEditedBatches(next, amount, sale, editId, userId, settings);
    }
  }
  for (const line of savedLines.filter((row) => row.track_batches && !row.input_id)) {
    allocateEditedBatches(line, line.base_quantity, sale, editId, userId, settings);
  }
  // Batch movements are recorded per lot above; product_stock remains the
  // aggregate physical quantity for the warehouse.
  const productDeltas = new Map();
  for (const oldLine of oldLines) {
    if (!oldLine.product_id) continue;
    const product = db.prepare("SELECT track_batches FROM products WHERE id=?").get(oldLine.product_id);
    if (product?.track_batches)
      productDeltas.set(Number(oldLine.product_id), (productDeltas.get(Number(oldLine.product_id)) || 0) + Number(oldLine.base_quantity || 0));
  }
  for (const line of savedLines.filter((row) => row.track_batches))
    productDeltas.set(Number(line.product_id), (productDeltas.get(Number(line.product_id)) || 0) - Number(line.base_quantity || 0));
  productDeltas.forEach((quantity, productId) =>
    changeEditedProductStock(productId, sale.warehouse_id, quantity),
  );
}

const editSale = db.transaction((id, data, user) => {
  if (!["admin", "manager"].includes(user.role))
    throw new PosError("Sale editing is not allowed for this user", 403);
  if (!data.client_request_id)
    throw new PosError("Sale edit request identifier is required");
  const duplicate = db
    .prepare("SELECT sale_id FROM sale_edit_requests WHERE client_request_id=?")
    .get(data.client_request_id);
  if (duplicate) return hydrateSale(duplicate.sale_id);
  const sale = getSale(id, user);
  if (sale.sale_status === "CANCELLED")
    throw new PosError("A cancelled sale cannot be edited", 409);
  if (sale.sale_status !== "CONFIRMED")
    throw new PosError("Only a confirmed sale can be edited", 409);
  const settings = {
    sales: Settings.getGroup("sales"),
    expiration: Settings.getGroup("expiration"),
  };
  const requestedFulfillment =
    data.fulfillment_type === "SHIPPING" ? "SHIPPING" : "IMMEDIATE";
  if (requestedFulfillment !== sale.fulfillment_type)
    throw new PosError(
      "The fulfillment mode cannot be changed after validation",
      409,
    );
  let customer = null;
  if (data.customer_id != null) {
    customer = db
      .prepare("SELECT id FROM customers WHERE id=? AND is_active=1")
      .get(Number(data.customer_id));
    if (!customer) throw new PosError("The selected customer is inactive");
  }
  if (sale.fulfillment_type === "SHIPPING" && !customer)
    throw new PosError("A sale to deliver requires a valid customer");
  const calculated = calculateLines(data.lines, settings.sales).map(
    (line, index) => ({
      ...line,
      input_id: Number(data.lines[index].id) || null,
    }),
  );
  const summary = totals(
    calculated,
    {
      type: data.global_discount_type,
      value: data.global_discount_value ?? data.global_discount_percent,
    },
    settings.sales,
  );
  const oldLines = db
    .prepare("SELECT * FROM sale_lines WHERE sale_id=? ORDER BY id")
    .all(sale.id);
  const oldById = new Map(oldLines.map((line) => [Number(line.id), line]));
  const inputIds = calculated
    .filter((line) => line.input_id)
    .map((line) => line.input_id);
  if (
    new Set(inputIds).size !== inputIds.length ||
    inputIds.some((lineId) => !oldById.has(lineId))
  )
    throw new PosError("A sale line is invalid", 409);
  const returnedRows = db
    .prepare(
      `SELECT rl.sale_line_id,COALESCE(SUM(rl.quantity),0) quantity FROM sales_return_lines rl JOIN sales_returns r ON r.id=rl.return_id WHERE r.sale_id=? AND r.status='VALIDATED' GROUP BY rl.sale_line_id`,
    )
    .all(sale.id);
  const returned = new Map(
    returnedRows.map((row) => [Number(row.sale_line_id), Number(row.quantity)]),
  );
  for (const oldLine of oldLines) {
    const next = calculated.find(
      (line) => line.input_id === Number(oldLine.id),
    );
    const minimum = returned.get(Number(oldLine.id)) || 0;
    if (
      (!next && minimum > 0) ||
      (next && Number(next.quantity) + 1e-9 < minimum)
    )
      throw new PosError(
        `La quantité de ${oldLine.designation} ne peut pas être inférieure à la quantité déjà retournée (${minimum}).`,
        409,
      );
    if (
      minimum > 0 &&
      next &&
      (Number(next.product_id) !== Number(oldLine.product_id) ||
        Number(next.product_unit_id) !== Number(oldLine.product_unit_id))
    )
      throw new PosError(
        "A returned sale line cannot change product or packaging",
        409,
      );
  }
  const deliveries = db
    .prepare("SELECT * FROM deliveries WHERE sale_id=? ORDER BY id")
    .all(sale.id);
  const lineChanges =
    oldLines.length !== calculated.length ||
    calculated.some((line) => {
      const old = oldById.get(line.input_id);
      return (
        !old ||
        Number(old.product_unit_id) !== Number(line.product_unit_id) ||
        Math.abs(Number(old.quantity) - Number(line.quantity)) > 1e-9
      );
    });
  if (
    sale.fulfillment_type === "SHIPPING" &&
    deliveries.some((delivery) =>
      ["SHIPPED", "DELIVERED"].includes(delivery.status),
    ) &&
    lineChanges
  )
    throw new PosError(
      "Cette vente a déjà été expédiée. Les articles et quantités ne peuvent plus être modifiés.",
      409,
    );
  const editId = Number(
    db
      .prepare(
        "INSERT INTO sale_edit_requests(client_request_id,sale_id,old_total,new_total,edited_by) VALUES(?,?,?,?,?)",
      )
      .run(data.client_request_id, sale.id, sale.total, summary.total, user.id)
      .lastInsertRowid,
  );
  const removed = oldLines.filter(
    (line) => !inputIds.includes(Number(line.id)),
  );
  for (const line of removed)
    if (
      db
        .prepare("SELECT 1 FROM invoice_lines WHERE sale_line_id=? LIMIT 1")
        .get(line.id)
    )
      throw new PosError("A sale line linked to an invoice cannot be removed", 409);
  const stockDeltas = new Map();
  if (sale.fulfillment_type === "IMMEDIATE") {
    for (const old of oldLines)
      if (old.product_id && old.base_quantity != null)
        stockDeltas.set(
          Number(old.product_id),
          (stockDeltas.get(Number(old.product_id)) || 0) + Number(old.base_quantity),
        );
    for (const next of calculated)
      if (next.product_id && next.base_quantity != null)
        stockDeltas.set(
          Number(next.product_id),
          (stockDeltas.get(Number(next.product_id)) || 0) - Number(next.base_quantity),
        );
    for (const [productId, stockIn] of stockDeltas) {
      if (stockIn >= -1e-9) continue;
      const product = db
          .prepare("SELECT designation FROM products WHERE id=?")
          .get(productId),
        available = Number(
          db
            .prepare(
              "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
            )
            .get(productId, sale.warehouse_id)?.quantity || 0,
        );
      if (available + stockIn < -1e-9 && !settings.sales.allow_negative_stock)
        throw new PosError(`Insufficient stock for ${product.designation}`, 409);
    }
  }
  const updateLine = db.prepare(
    `UPDATE sale_lines SET line_type=?,product_id=?,product_unit_id=?,designation=?,reference=?,barcode=?,unit_name=?,conversion_factor=?,quantity=?,base_quantity=?,unit_price=?,discount_percent=?,discount_type=?,discount_value=?,discount_amount=?,subtotal=?,total=? WHERE id=? AND sale_id=?`,
  );
  for (const line of calculated.filter((line) => line.input_id))
    updateLine.run(
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
      line.input_id,
      sale.id,
    );
  if (sale.fulfillment_type === "SHIPPING")
    db.prepare(
      "DELETE FROM delivery_lines WHERE delivery_id IN (SELECT id FROM deliveries WHERE sale_id=?)",
    ).run(sale.id);
  const inserted = insertLines(
    sale.id,
    calculated.filter((line) => !line.input_id),
  );
  const savedLines = [
    ...calculated.filter((line) => line.input_id),
    ...inserted,
  ].map((line) => ({ ...line, id: line.input_id || line.id }));
  if (sale.fulfillment_type === "IMMEDIATE") {
    reconcileEditedSerials(oldLines, savedLines, sale, editId, user.id);
    reconcileEditedBatches(
      oldLines,
      savedLines,
      sale,
      editId,
      user.id,
      settings,
    );
    for (const [productId, stockIn] of stockDeltas) {
      if (Math.abs(stockIn) <= 1e-9) continue;
      const product = db
        .prepare("SELECT track_batches,track_serials FROM products WHERE id=?")
        .get(productId);
      if (product?.track_batches || product?.track_serials) continue;
      editMovement(
        productId,
        sale.warehouse_id,
        stockIn,
        editId,
        sale,
        user.id,
      );
      changeEditedProductStock(productId, sale.warehouse_id, stockIn);
    }
  }
  for (const line of removed)
    db.prepare("DELETE FROM sale_lines WHERE id=?").run(line.id);
  if (
    sale.fulfillment_type === "SHIPPING" &&
    deliveries.every((delivery) => delivery.status === "PREPARED")
  ) {
    const insertDelivery = db.prepare(
      "INSERT INTO delivery_lines(delivery_id,sale_line_id,product_id,designation,unit_name,quantity,base_quantity) VALUES(?,?,?,?,?,?,?)",
    );
    for (const delivery of deliveries)
      for (const line of savedLines)
        insertDelivery.run(
          delivery.id,
          line.id,
          line.product_id,
          line.designation,
          line.unit_name,
          line.quantity,
          line.base_quantity,
        );
  }
  const paymentStatus = syncEditedSaleAccount(
    sale,
    customer?.id || null,
    summary.total,
    user.id,
  );
  db.prepare(
    `UPDATE sales SET customer_id=?,document_type=?,subtotal=?,line_discount_total=?,global_discount_percent=?,global_discount_type=?,global_discount_value=?,global_discount_amount=?,total=?,note=?,customer_reference=?,payment_status=?,edited_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
  ).run(
    customer?.id || null,
    data.document_type === "TICKET" ? "TICKET" : "BON_POUR",
    summary.subtotal,
    summary.line_discount_total,
    summary.global_discount_percent,
    summary.global_discount_type,
    summary.global_discount_value,
    summary.global_discount_amount,
    summary.total,
    String(data.note || "").trim() || null,
    String(data.customer_reference || "").trim() || null,
    paymentStatus,
    user.id,
    sale.id,
  );
  return hydrateSale(sale.id);
});
module.exports = {
  PosError,
  money,
  context,
  searchProducts,
  customerSearch,
  productUnits,
  availableSerials,
  addAvailableSerial,
  calculateLines,
  totals,
  finalize,
  suspend,
  suspended,
  getSale,
  editSale,
  applyStock,
};
