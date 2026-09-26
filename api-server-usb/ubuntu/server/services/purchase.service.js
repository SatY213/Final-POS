const db = require("../config/database");
const Settings = require("./settings.service");
const Inventory = require("./inventory.service");

class PurchaseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const money = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const quantity = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
const today = () => new Date().toISOString().slice(0, 10);

function authorize(user, warehouseId) {
  if (!["admin", "manager"].includes(user.role))
    throw new PurchaseError("Purchase management requires manager access", 403);
  const allowed = new Set(
    [user.warehouse_id, ...(user.warehouse_ids || [])]
      .filter(Boolean)
      .map(Number),
  );
  if (user.role !== "admin" && !allowed.has(Number(warehouseId)))
    throw new PurchaseError("Warehouse is unauthorized", 403);
}
function activeSupplier(id) {
  const supplier = db
    .prepare("SELECT * FROM suppliers WHERE id=? AND is_active=1")
    .get(Number(id));
  if (!supplier) throw new PurchaseError("Active supplier required", 409);
  return supplier;
}
function productLine(input) {
  const qty = quantity(input.quantity),
    unitPrice = money(input.unit_price || 0);
  if (!(qty > 0) || unitPrice < 0)
    throw new PurchaseError("Invalid quantity, price or discount");
  if (!input.product_id) {
    const designation = String(input.designation || "").trim();
    if (!designation)
      throw new PurchaseError("Invalid miscellaneous purchase line");
    return {
      product_id: null,
      product_unit_id: null,
      designation,
      unit_name: String(input.unit_name || "Unité"),
      conversion_factor: 1,
      quantity: qty,
      unit_price: unitPrice,
      total: money(qty * unitPrice),
    };
  }
  const row = db
    .prepare(
      `SELECT p.id product_id,p.designation,p.track_stock,p.track_batches,p.track_expiration,p.track_serials,
    pu.id product_unit_id,pu.conversion_factor,u.name unit_name
    FROM products p JOIN product_units pu ON pu.product_id=p.id AND pu.id=? AND pu.is_active=1 JOIN units u ON u.id=pu.unit_id
    WHERE p.id=? AND p.is_active=1`,
    )
    .get(Number(input.product_unit_id), Number(input.product_id));
  if (!row) throw new PurchaseError("Product packaging unavailable", 409);
  return {
    ...row,
    quantity: qty,
    unit_price: unitPrice,
    total: money(qty * unitPrice),
  };
}
function syncOrder(orderId) {
  if (!orderId) return null;
  const rows = db
    .prepare(
      `SELECT l.quantity,
    COALESCE((SELECT SUM(rl.quantity) FROM purchase_receipt_lines rl JOIN purchase_receipts r ON r.id=rl.purchase_receipt_id
      WHERE rl.purchase_order_line_id=l.id AND r.status<>'CANCELLED'),0) received
    FROM purchase_order_lines l WHERE l.purchase_order_id=?`,
    )
    .all(orderId);
  const received = rows.reduce((sum, row) => sum + Number(row.received), 0);
  const ordered = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
  const status =
    received <= 1e-9
      ? "NOT_RECEIVED"
      : received + 1e-9 >= ordered
        ? "RECEIVED"
        : "PARTIALLY_RECEIVED";
  db.prepare(
    "UPDATE purchase_orders SET status=? WHERE id=? AND status<>'CANCELLED'",
  ).run(status, orderId);
  return status;
}
function context(query, user) {
  const warehouseId = Number(query.warehouse_id);
  authorize(user, warehouseId);
  const products = db
    .prepare(
      `SELECT p.id,p.designation,p.reference,p.track_batches,p.track_expiration,p.track_serials,pu.id product_unit_id,pu.purchase_price,pu.conversion_factor,u.name unit_name,
      (SELECT group_concat(pb.barcode,' ') FROM product_barcodes pb WHERE pb.product_unit_id=pu.id) barcodes
    FROM products p JOIN product_units pu ON pu.product_id=p.id AND pu.is_active=1 JOIN units u ON u.id=pu.unit_id WHERE p.is_active=1 ORDER BY p.designation,pu.is_base DESC`,
    )
    .all();
  return {
    suppliers: db
      .prepare("SELECT * FROM suppliers WHERE is_active=1 ORDER BY name")
      .all(),
    products,
    payment_methods: db
      .prepare(
        "SELECT * FROM payment_methods WHERE is_active=1 AND code<>'CUSTOMER_CREDIT' ORDER BY sort_order,id",
      )
      .all(),
  };
}
function createSupplier(data, user) {
  if (!["admin", "manager"].includes(user.role))
    throw new PurchaseError("Purchase management requires manager access", 403);
  const name = String(data.name || "").trim();
  if (!name) throw new PurchaseError("Supplier name is required");
  const id = Number(
    db
      .prepare(
        "INSERT INTO suppliers(name,phone,email,address) VALUES(?,?,?,?)",
      )
      .run(name, data.phone || null, data.email || null, data.address || null)
      .lastInsertRowid,
  );
  return db.prepare("SELECT * FROM suppliers WHERE id=?").get(id);
}

const createOrder = db.transaction((data, user) => {
  authorize(user, data.warehouse_id);
  const duplicate =
    data.client_request_id &&
    db
      .prepare("SELECT id FROM purchase_orders WHERE client_request_id=?")
      .get(data.client_request_id);
  if (duplicate) return orderDetail(duplicate.id, user);
  activeSupplier(data.supplier_id);
  const lines = (data.lines || []).map(productLine);
  if (!lines.length) throw new PurchaseError("Add at least one product");
  const id = Number(
    db
      .prepare(
        `INSERT INTO purchase_orders(client_request_id,order_number,warehouse_id,supplier_id,order_date,supplier_reference,note,created_by)
    VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        data.client_request_id || null,
        Settings.nextDocumentNumber(
          "PURCHASE_ORDER",
          Number(data.warehouse_id),
        ),
        Number(data.warehouse_id),
        Number(data.supplier_id),
        data.order_date || today(),
        String(data.supplier_reference || "").trim() || null,
        String(data.note || "").trim() || null,
        user.id,
      ).lastInsertRowid,
  );
  const insert = db.prepare(
    `INSERT INTO purchase_order_lines(purchase_order_id,product_id,product_unit_id,designation,unit_name,conversion_factor,quantity,unit_price,total) VALUES(?,?,?,?,?,?,?,?,?)`,
  );
  lines.forEach((line) =>
    insert.run(
      id,
      line.product_id,
      line.product_unit_id,
      line.designation,
      line.unit_name,
      line.conversion_factor,
      line.quantity,
      line.unit_price,
      line.total,
    ),
  );
  return orderDetail(id, user);
});
function orderDetail(id, user) {
  const order = db
    .prepare(
      `SELECT o.*,s.name supplier_name,s.phone supplier_phone,s.email supplier_email,s.address supplier_address,
        s.nif supplier_nif,s.nis supplier_nis,s.rib supplier_rib,s.tax_article supplier_tax_article,
        s.commercial_register supplier_commercial_register,s.business_activity supplier_business_activity,
        w.name warehouse_name,w.phone warehouse_phone,w.email warehouse_email,w.address warehouse_address,
        w.nif warehouse_nif,w.nis warehouse_nis,w.rib warehouse_rib,w.tax_article warehouse_tax_article,
        w.commercial_register warehouse_commercial_register,w.business_activity warehouse_business_activity
       FROM purchase_orders o JOIN suppliers s ON s.id=o.supplier_id JOIN warehouses w ON w.id=o.warehouse_id WHERE o.id=?`,
    )
    .get(Number(id));
  if (!order) throw new PurchaseError("Purchase order not found", 404);
  authorize(user, order.warehouse_id);
  order.lines = db
    .prepare(
      `SELECT l.*,p.reference,p.track_batches,p.track_expiration,p.track_serials,COALESCE((SELECT SUM(rl.quantity) FROM purchase_receipt_lines rl JOIN purchase_receipts r ON r.id=rl.purchase_receipt_id WHERE rl.purchase_order_line_id=l.id AND r.status<>'CANCELLED'),0) received_quantity FROM purchase_order_lines l LEFT JOIN products p ON p.id=l.product_id WHERE l.purchase_order_id=? ORDER BY l.id`,
    )
    .all(order.id)
    .map((line) => ({
      ...line,
      remaining_quantity: Math.max(
        0,
        quantity(Number(line.quantity) - Number(line.received_quantity)),
      ),
    }));
  order.total = money(order.lines.reduce((sum, line) => sum + Number(line.total || 0), 0));
  order.print_profile = Settings.profiles().find((profile) => profile.document_type === "PURCHASE_ORDER") || null;
  return order;
}
function listOrders(query, user) {
  authorize(user, query.warehouse_id);
  return db
    .prepare(
      `SELECT o.*,s.name supplier_name,COALESCE((SELECT SUM(total) FROM purchase_order_lines WHERE purchase_order_id=o.id),0) total FROM purchase_orders o JOIN suppliers s ON s.id=o.supplier_id WHERE o.warehouse_id=? ORDER BY o.order_date DESC,o.id DESC`,
    )
    .all(Number(query.warehouse_id));
}

const createReceipt = db.transaction((data, user) => {
  authorize(user, data.warehouse_id);
  const duplicate =
    data.client_request_id &&
    db
      .prepare("SELECT id FROM purchase_receipts WHERE client_request_id=?")
      .get(data.client_request_id);
  if (duplicate) {
    const existing = receiptDetail(duplicate.id, user);
    return existing.status === "DRAFT"
      ? postReceipt(existing.id, user)
      : existing;
  }
  const order = data.purchase_order_id
    ? orderDetail(data.purchase_order_id, user)
    : null;
  const supplierId = Number(data.supplier_id || order?.supplier_id),
    warehouseId = Number(data.warehouse_id || order?.warehouse_id);
  if (
    order &&
    (supplierId !== Number(order.supplier_id) ||
      warehouseId !== Number(order.warehouse_id))
  )
    throw new PurchaseError("Purchase order belongs to another warehouse", 409);
  activeSupplier(supplierId);
  const orderLines = new Map(
    (order?.lines || []).map((line) => [Number(line.id), line]),
  );
  const lines = (data.lines || []).map((input) => {
    const source = input.purchase_order_line_id
      ? orderLines.get(Number(input.purchase_order_line_id))
      : null;
    const line = source
      ? {
          ...source,
          quantity: quantity(input.quantity),
          unit_price: money(input.unit_price ?? source.unit_price),
        }
      : productLine(input);
    if (
      !(line.quantity > 0) ||
      (source && line.quantity - Number(source.remaining_quantity) > 1e-9)
    )
      throw new PurchaseError(
        "Received quantity exceeds remaining ordered quantity",
        409,
      );
    return {
      ...line,
      purchase_order_line_id: source?.id || null,
      total: money(line.quantity * line.unit_price),
      traceability_json: JSON.stringify({
        serial_numbers: input.serial_numbers || [],
        batch_number: input.batch_number || null,
        expiration_date: input.expiration_date || null,
      }),
    };
  });
  if (!lines.length) throw new PurchaseError("Add at least one product");
  const id = Number(
    db
      .prepare(
        `INSERT INTO purchase_receipts(client_request_id,receipt_number,purchase_order_id,warehouse_id,supplier_id,receipt_date,supplier_reference,note,created_by)
    VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        data.client_request_id || null,
        Settings.nextDocumentNumber("PURCHASE_RECEIPT", warehouseId),
        order?.id || null,
        warehouseId,
        supplierId,
        data.receipt_date || today(),
        String(data.supplier_reference || "").trim() || null,
        String(data.note || "").trim() || null,
        user.id,
      ).lastInsertRowid,
  );
  const insert = db.prepare(
    `INSERT INTO purchase_receipt_lines(purchase_receipt_id,purchase_order_line_id,product_id,product_unit_id,designation,unit_name,conversion_factor,quantity,base_quantity,unit_price,total,traceability_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  lines.forEach((line) =>
    insert.run(
      id,
      line.purchase_order_line_id,
      line.product_id,
      line.product_unit_id,
      line.designation,
      line.unit_name,
      line.conversion_factor,
      line.quantity,
      quantity(line.quantity * line.conversion_factor),
      line.unit_price,
      line.total,
      line.traceability_json,
    ),
  );
  // A receipt is posted as soon as it is created. DRAFT only exists inside
  // this transaction so stock and financial side effects remain atomic.
  return postReceipt(id, user);
});
function receiptDetail(id, user) {
  const receipt = db
    .prepare(
      `SELECT r.*,s.name supplier_name,s.phone supplier_phone,s.email supplier_email,s.address supplier_address,
        s.nif supplier_nif,s.nis supplier_nis,s.rib supplier_rib,s.tax_article supplier_tax_article,
        s.commercial_register supplier_commercial_register,s.business_activity supplier_business_activity,
        o.order_number,w.name warehouse_name,w.phone warehouse_phone,w.email warehouse_email,w.address warehouse_address,
        w.nif warehouse_nif,w.nis warehouse_nis,w.rib warehouse_rib,w.tax_article warehouse_tax_article,
        w.commercial_register warehouse_commercial_register,w.business_activity warehouse_business_activity
       FROM purchase_receipts r JOIN suppliers s ON s.id=r.supplier_id LEFT JOIN purchase_orders o ON o.id=r.purchase_order_id JOIN warehouses w ON w.id=r.warehouse_id WHERE r.id=?`,
    )
    .get(Number(id));
  if (!receipt) throw new PurchaseError("Purchase receipt not found", 404);
  authorize(user, receipt.warehouse_id);
  receipt.lines = db
    .prepare(
      `SELECT l.*,p.reference,p.track_batches,p.track_expiration,p.track_serials,
        COALESCE((SELECT SUM(rl.quantity) FROM supplier_return_lines rl JOIN supplier_returns r ON r.id=rl.supplier_return_id WHERE rl.purchase_receipt_line_id=l.id AND r.status='VALIDATED'),0) returned_quantity
       FROM purchase_receipt_lines l LEFT JOIN products p ON p.id=l.product_id WHERE l.purchase_receipt_id=? ORDER BY l.id`,
    )
    .all(receipt.id)
    .map((line) => {
      let trace = {};
      try {
        trace = JSON.parse(line.traceability_json || "{}");
      } catch {}
      const receivedReturnable = Math.max(
          0,
          quantity(Number(line.quantity) - Number(line.returned_quantity)),
        ),
        conversionFactor = Number(line.conversion_factor || 1);
      let availableBaseQuantity = Number.POSITIVE_INFINITY,
        availableSerialNumbers = [];
      if (line.product_id) {
        availableBaseQuantity = Number(
          db
            .prepare(
              "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
            )
            .get(line.product_id, receipt.warehouse_id)?.quantity || 0,
        );
        if (line.track_batches) {
          const batchQuantity = Number(
            db
              .prepare(
                `SELECT quantity FROM stock_batches
                 WHERE product_id=? AND warehouse_id=? AND batch_number=?
                   AND expiration_date IS ?`,
              )
              .get(
                line.product_id,
                receipt.warehouse_id,
                String(trace.batch_number || "").trim(),
                trace.expiration_date || null,
              )?.quantity || 0,
          );
          availableBaseQuantity = Math.min(
            availableBaseQuantity,
            batchQuantity,
          );
        }
        if (line.track_serials) {
          const sourceSerials = new Set(
              (trace.serial_numbers || []).map((value) =>
                String(value).trim().toLocaleLowerCase(),
              ),
            ),
            available = db
              .prepare(
                `SELECT serial_number FROM stock_serials
                 WHERE product_id=? AND warehouse_id=? AND status='AVAILABLE'
                 ORDER BY received_at,id`,
              )
              .all(line.product_id, receipt.warehouse_id)
              .map((row) => String(row.serial_number));
          availableSerialNumbers = available.filter((serial) =>
            sourceSerials.has(serial.trim().toLocaleLowerCase()),
          );
          availableBaseQuantity = Math.min(
            availableBaseQuantity,
            availableSerialNumbers.length,
          );
        }
      }
      const stockReturnable = Number.isFinite(availableBaseQuantity)
        ? Math.max(0, quantity(availableBaseQuantity / conversionFactor))
        : receivedReturnable;
      return {
        ...line,
        serial_numbers: trace.serial_numbers || [],
        batch_number: trace.batch_number || "",
        expiration_date: trace.expiration_date || "",
        received_returnable_quantity: receivedReturnable,
        stock_returnable_quantity: stockReturnable,
        available_serial_numbers: availableSerialNumbers,
        returnable_quantity: Math.min(receivedReturnable, stockReturnable),
      };
    });
  receipt.total = money(
    receipt.lines.reduce((sum, line) => sum + Number(line.total || 0), 0),
  );
  receipt.returns = db
    .prepare(
      `SELECT id,return_number,return_date,total,status,settlement_mode,refund_amount
       FROM supplier_returns WHERE purchase_receipt_id=? ORDER BY return_date DESC,id DESC`,
    )
    .all(receipt.id);
  receipt.return_summary = {
    return_total: money(
      receipt.returns
        .filter((item) => item.status === "VALIDATED")
        .reduce((sum, item) => sum + Number(item.total || 0), 0),
    ),
  };
  receipt.return_summary.net_purchase_amount = Math.max(
    0,
    money(receipt.total - receipt.return_summary.return_total),
  );
  receipt.payments = db.prepare(
    `SELECT t.id,t.amount,t.created_at,t.payment_method_code,
      COALESCE(pm.name,t.payment_method_code) payment_method_name
     FROM financial_transactions t LEFT JOIN payment_methods pm ON pm.code=t.payment_method_code
     WHERE t.purchase_receipt_id=? AND t.source_type='PURCHASE_PAYMENT'
     ORDER BY t.created_at,t.id`,
  ).all(receipt.id);
  const paidTotal = money(receipt.payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
  const refundedTotal = money(receipt.returns
    .filter((item) => item.status === "VALIDATED")
    .reduce((sum, item) => sum + Number(item.refund_amount || 0), 0));
  const balanceDue = Math.max(0, money(receipt.return_summary.net_purchase_amount - paidTotal));
  receipt.payment_summary = {
    paid_total: paidTotal,
    return_total: receipt.return_summary.return_total,
    refunded_total: refundedTotal,
    balance_due: balanceDue,
    supplier_credit: Math.max(0, money(paidTotal - receipt.return_summary.net_purchase_amount - refundedTotal)),
    payment_status: balanceDue <= 0.001
      ? "PAID"
      : paidTotal > 0 ? "PARTIALLY_PAID" : "UNPAID",
  };
  receipt.paid_amount = paidTotal;
  receipt.balance_due = balanceDue;
  receipt.payment_status = receipt.payment_summary.payment_status;
  receipt.print_profile =
    Settings.profiles().find(
      (profile) => profile.document_type === "PURCHASE_RECEIPT",
    ) || null;
  receipt.return_status = receipt.lines.some(
    (line) => Number(line.returned_quantity) > 0,
  )
    ? receipt.lines.every((line) => Number(line.returnable_quantity) <= 1e-9)
      ? "RETURNED"
      : "PARTIALLY_RETURNED"
    : "NOT_RETURNED";
  return receipt;
}

function receiptEditMovement(receipt, productId, quantityValue, editId, userId, batchId = null) {
  if (Math.abs(Number(quantityValue)) <= 1e-9) return;
  db.prepare(
    `INSERT INTO stock_movements(product_id,warehouse_id,batch_id,type,quantity,reference_type,reference_id,note,created_by)
     VALUES(?,?,?,?,?,'PURCHASE_RECEIPT_EDIT',?,?,?)`,
  ).run(
    productId,
    receipt.warehouse_id,
    batchId,
    quantityValue > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
    quantityValue,
    String(editId),
    `Modification ${receipt.receipt_number}`,
    userId,
  );
}

function changeReceiptStock(receipt, productId, delta) {
  if (Math.abs(Number(delta)) <= 1e-9) return;
  const available = Number(
    db
      .prepare(
        "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
      )
      .get(productId, receipt.warehouse_id)?.quantity || 0,
  );
  if (delta < 0 && available + delta < -1e-9)
    throw new PurchaseError("Insufficient stock for purchase correction", 409);
  db.prepare(
    "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,?) ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=quantity+excluded.quantity",
  ).run(productId, receipt.warehouse_id, delta);
}

function reconcileReceiptTrace(receipt, oldLine, nextLine, editId, user) {
  const productId = Number(nextLine?.product_id || oldLine?.product_id);
  if (!productId) return;
  const product = db
    .prepare(
      "SELECT designation,track_batches,track_expiration,track_serials FROM products WHERE id=?",
    )
    .get(productId);
  const oldBase = Number(oldLine?.base_quantity || 0),
    nextBase = Number(nextLine?.base_quantity || 0),
    delta = quantity(nextBase - oldBase);
  let oldTrace = {};
  try {
    oldTrace = JSON.parse(oldLine?.traceability_json || "{}");
  } catch {}
  const nextTrace = nextLine?.trace || {};
  if (product.track_serials) {
    if (nextBase && !Number.isInteger(nextBase))
      throw new PurchaseError(
        `Serialized quantity must be a whole number for ${product.designation}`,
        409,
      );
    const oldSerials = (oldTrace.serial_numbers || []).map(String),
      nextSerials = (nextTrace.serial_numbers || []).map(String),
      normalize = (value) => value.trim().toLocaleLowerCase(),
      oldKeys = new Map(oldSerials.map((value) => [normalize(value), value])),
      nextKeys = new Map(nextSerials.map((value) => [normalize(value), value]));
    if (nextSerials.length !== nextBase || nextKeys.size !== nextSerials.length)
      throw new PurchaseError(
        `Each stock unit requires one serial number for ${product.designation}`,
        409,
      );
    for (const [key, serialNumber] of oldKeys)
      if (!nextKeys.has(key)) {
        const serial = db
          .prepare(
            "SELECT id,status FROM stock_serials WHERE product_id=? AND warehouse_id=? AND serial_number=? COLLATE NOCASE",
          )
          .get(productId, receipt.warehouse_id, serialNumber);
        if (!serial || serial.status !== "AVAILABLE")
          throw new PurchaseError(
            `Serial number ${serialNumber} is no longer available and cannot be removed`,
            409,
          );
        db.prepare("DELETE FROM stock_serials WHERE id=?").run(serial.id);
      }
    const insert = db.prepare(
      "INSERT INTO stock_serials(product_id,warehouse_id,serial_number,status) VALUES(?,?,?,'AVAILABLE')",
    );
    try {
      for (const [key, serialNumber] of nextKeys)
        if (!oldKeys.has(key))
          insert.run(productId, receipt.warehouse_id, serialNumber);
    } catch (error) {
      if (String(error.code).includes("SQLITE_CONSTRAINT"))
        throw new PurchaseError("A serial number already exists", 409);
      throw error;
    }
  }
  if (product.track_batches) {
    const oldBatchNumber = String(oldTrace.batch_number || "").trim(),
      oldExpiration = oldTrace.expiration_date || null,
      nextBatchNumber = String(nextTrace.batch_number || "").trim(),
      nextExpiration = nextTrace.expiration_date || null;
    if (nextBase > 0 && !nextBatchNumber)
      throw new PurchaseError(`Batch number is required for ${product.designation}`, 409);
    const sameBatch =
      oldBatchNumber === nextBatchNumber && oldExpiration === nextExpiration;
    const changeBatch = (batchNumber, expiration, amount) => {
      if (!batchNumber || Math.abs(amount) <= 1e-9) return null;
      let batch = db
        .prepare(
          "SELECT id,quantity FROM stock_batches WHERE product_id=? AND warehouse_id=? AND batch_number=? AND expiration_date IS ?",
        )
        .get(productId, receipt.warehouse_id, batchNumber, expiration);
      if (amount < 0 && (!batch || Number(batch.quantity) + amount < -1e-9))
        throw new PurchaseError(
          `Batch ${batchNumber} no longer contains enough stock for this correction`,
          409,
        );
      if (!batch) {
        const id = Number(
          db
            .prepare(
              "INSERT INTO stock_batches(product_id,warehouse_id,batch_number,expiration_date,quantity) VALUES(?,?,?,?,?)",
            )
            .run(productId, receipt.warehouse_id, batchNumber, expiration, amount)
            .lastInsertRowid,
        );
        batch = { id };
      } else
        db.prepare("UPDATE stock_batches SET quantity=quantity+? WHERE id=?").run(
          amount,
          batch.id,
        );
      receiptEditMovement(receipt, productId, amount, editId, user.id, batch.id);
      return batch.id;
    };
    if (sameBatch) changeBatch(nextBatchNumber, nextExpiration, delta);
    else {
      changeBatch(oldBatchNumber, oldExpiration, -oldBase);
      changeBatch(nextBatchNumber, nextExpiration, nextBase);
    }
  } else receiptEditMovement(receipt, productId, delta, editId, user.id);
  changeReceiptStock(receipt, productId, delta);
}

const updateReceipt = db.transaction((id, data, user) => {
  const receipt = receiptDetail(id, user);
  if (!["DRAFT", "VALIDATED"].includes(receipt.status))
    throw new PurchaseError("This receipt can no longer be edited", 409);
  const isLegacyDraft = receipt.status === "DRAFT";
  const requestId = String(data.client_request_id || "").trim();
  if (!requestId) throw new PurchaseError("Purchase edit request identifier is required");
  const duplicate = db
    .prepare(
      "SELECT purchase_receipt_id FROM purchase_receipt_edit_requests WHERE client_request_id=?",
    )
    .get(requestId);
  if (duplicate) return receiptDetail(duplicate.purchase_receipt_id, user);
  if (Number(data.supplier_id || receipt.supplier_id) !== Number(receipt.supplier_id))
    throw new PurchaseError("The supplier cannot be changed after validation", 409);
  const oldById = new Map(receipt.lines.map((line) => [Number(line.id), line]));
  if (!Array.isArray(data.lines) || !data.lines.length)
    throw new PurchaseError("Add at least one product");
  const nextLines = data.lines.map((input) => {
    const old = input.id ? oldById.get(Number(input.id)) : null,
      line = productLine(input);
    if (input.id && !old) throw new PurchaseError("A purchase line is invalid", 409);
    if (
      old &&
      (Number(old.product_id || 0) !== Number(line.product_id || 0) ||
        Number(old.product_unit_id || 0) !== Number(line.product_unit_id || 0))
    )
      throw new PurchaseError("A received line cannot change product or packaging", 409);
    const minimum = Number(old?.returned_quantity || 0);
    if (old && Number(line.quantity) + 1e-9 < minimum)
      throw new PurchaseError(
        `Received quantity cannot be lower than the already used quantity (${minimum})`,
        409,
      );
    const trace = {
      serial_numbers: input.serial_numbers || old?.serial_numbers || [],
      batch_number: input.batch_number ?? old?.batch_number ?? null,
      expiration_date: input.expiration_date ?? old?.expiration_date ?? null,
    };
    return {
      ...line,
      id: old?.id || null,
      purchase_order_line_id: old?.purchase_order_line_id || input.purchase_order_line_id || null,
      base_quantity: quantity(line.quantity * line.conversion_factor),
      trace,
      traceability_json: JSON.stringify(trace),
    };
  });
  const ids = nextLines.filter((line) => line.id).map((line) => Number(line.id));
  if (receipt.purchase_order_id)
    for (const line of nextLines.filter((row) => row.purchase_order_line_id)) {
      const progress = db
        .prepare(
          `SELECT pol.quantity ordered_quantity,
           COALESCE((SELECT SUM(prl.quantity)
             FROM purchase_receipt_lines prl
             JOIN purchase_receipts pr ON pr.id=prl.purchase_receipt_id
             WHERE prl.purchase_order_line_id=pol.id
               AND pr.status<>'CANCELLED' AND pr.id<>?),0) other_received
           FROM purchase_order_lines pol
           WHERE pol.id=? AND pol.purchase_order_id=?`,
        )
        .get(receipt.id, line.purchase_order_line_id, receipt.purchase_order_id);
      if (
        !progress ||
        Number(progress.other_received) + Number(line.quantity) -
          Number(progress.ordered_quantity) >
          1e-9
      )
        throw new PurchaseError(
          "Received quantity exceeds remaining ordered quantity",
          409,
        );
    }
  const removed = receipt.lines.filter((line) => !ids.includes(Number(line.id)));
  for (const line of removed)
    if (Number(line.returned_quantity) > 0)
      throw new PurchaseError("A returned receipt line cannot be removed", 409);
  const newTotal = money(nextLines.reduce((sum, line) => sum + line.total, 0));
  const editId = Number(
    db
      .prepare(
        "INSERT INTO purchase_receipt_edit_requests(client_request_id,purchase_receipt_id,old_total,new_total,edited_by) VALUES(?,?,?,?,?)",
      )
      .run(requestId, receipt.id, receipt.total, newTotal, user.id).lastInsertRowid,
  );
  if (!isLegacyDraft)
    for (const old of receipt.lines) {
      const next = nextLines.find((line) => Number(line.id) === Number(old.id));
      reconcileReceiptTrace(receipt, old, next || null, editId, user);
    }
  const updateLine = db.prepare(
    `UPDATE purchase_receipt_lines SET quantity=?,base_quantity=?,unit_price=?,total=?,traceability_json=? WHERE id=? AND purchase_receipt_id=?`,
  );
  nextLines.filter((line) => line.id).forEach((line) => {
    updateLine.run(
      line.quantity,
      line.base_quantity,
      line.unit_price,
      line.total,
      line.traceability_json,
      line.id,
      receipt.id,
    );
  });
  removed.forEach((line) => {
    db.prepare("DELETE FROM purchase_receipt_lines WHERE id=?").run(line.id);
  });
  const insert = db.prepare(
    `INSERT INTO purchase_receipt_lines(purchase_receipt_id,purchase_order_line_id,product_id,product_unit_id,designation,unit_name,conversion_factor,quantity,base_quantity,unit_price,total,traceability_json)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  nextLines.filter((line) => !line.id).forEach((line) => {
    const lineId = Number(
      insert.run(
        receipt.id,
        line.purchase_order_line_id,
        line.product_id,
        line.product_unit_id,
        line.designation,
        line.unit_name,
        line.conversion_factor,
        line.quantity,
        line.base_quantity,
        line.unit_price,
        line.total,
        line.traceability_json,
      ).lastInsertRowid,
    );
    if (!isLegacyDraft)
      reconcileReceiptTrace(receipt, null, { ...line, id: lineId }, editId, user);
  });
  db.prepare(
    "UPDATE purchase_receipts SET receipt_date=?,note=?,supplier_reference=? WHERE id=?",
  ).run(
    data.receipt_date || receipt.receipt_date,
    String(data.note || receipt.note || "").trim() || null,
    String(data.supplier_reference || receipt.supplier_reference || "").trim() || null,
    receipt.id,
  );
  // Legacy versions could leave a receipt in DRAFT. Its first edit now posts
  // it immediately without subtracting stock that was never received.
  if (isLegacyDraft) return postReceipt(receipt.id, user);
  const debtDifference = money(newTotal - Number(receipt.total));
  if (Math.abs(debtDifference) > 0.001)
    db.prepare(
      `INSERT INTO supplier_account_entries(supplier_id,purchase_receipt_id,entry_type,amount,reference,created_by)
       VALUES(?,?,'ADJUSTMENT',?,?,?)`,
    ).run(receipt.supplier_id, receipt.id, debtDifference, receipt.receipt_number, user.id);
  syncOrder(receipt.purchase_order_id);
  return receiptDetail(receipt.id, user);
});

const addReceiptPayment = db.transaction((id, data, user) => {
  const receipt = receiptDetail(id, user);
  if (receipt.status !== "VALIDATED")
    throw new PurchaseError("A valid purchase receipt is required", 409);
  const requestId = String(data.client_request_id || "").trim();
  if (!requestId) throw new PurchaseError("Payment request identifier is required");
  const existing = db.prepare(
    "SELECT purchase_receipt_id,source_type FROM financial_transactions WHERE client_request_id=?",
  ).get(requestId);
  if (existing) {
    if (existing.source_type !== "PURCHASE_PAYMENT" || Number(existing.purchase_receipt_id) !== receipt.id)
      throw new PurchaseError("Payment request identifier is already used", 409);
    return receipt;
  }
  const amount = money(data.amount);
  if (!(amount > 0) || amount - receipt.balance_due > 0.001)
    throw new PurchaseError("Payment exceeds the remaining balance", 409);
  const method = db.prepare(
    "SELECT * FROM payment_methods WHERE code=? AND is_active=1 AND code<>'CUSTOMER_CREDIT'",
  ).get(data.payment_method_code);
  if (!method) throw new PurchaseError("Payment method is unavailable", 409);
  let session = null;
  if (method.affects_cash_drawer) {
    session = db.prepare(
      `SELECT cs.* FROM cash_sessions cs JOIN cash_registers cr ON cr.id=cs.cash_register_id
       WHERE cs.user_id=? AND cs.status='open' AND cr.warehouse_id=?`,
    ).get(user.id, receipt.warehouse_id);
    if (!session) throw new PurchaseError("An open cash session is required for cash payment", 409);
  }
  const transactionId = Number(db.prepare(
    `INSERT INTO financial_transactions(direction,party_type,supplier_id,payment_method_code,amount,reference,
       source_type,purchase_receipt_id,cash_session_id,client_request_id,created_by,created_at)
     VALUES('OUT','SUPPLIER',?,?,?,?, 'PURCHASE_PAYMENT',?,?,?,?,?)`,
  ).run(receipt.supplier_id, method.code, amount, receipt.receipt_number,
    receipt.id, session?.id || null, requestId, user.id,
    data.payment_date
      ? `${String(data.payment_date).slice(0, 10)} ${new Date().toISOString().slice(11, 19)}`
      : new Date().toISOString().slice(0, 19).replace("T", " ")).lastInsertRowid);
  db.prepare(
    `INSERT INTO supplier_account_entries(supplier_id,purchase_receipt_id,financial_transaction_id,entry_type,amount,reference,created_by)
     VALUES(?,?,?,'PAYMENT',?,?,?)`,
  ).run(receipt.supplier_id, receipt.id, transactionId, -amount, receipt.receipt_number, user.id);
  if (session)
    db.prepare(
      `INSERT INTO cash_movements(cash_session_id,direction,movement_type,amount,reference_type,reference_id,note,created_by)
       VALUES(?,'OUT','PURCHASE_PAYMENT',?,'PURCHASE_RECEIPT',?,?,?)`,
    ).run(session.id, amount, receipt.id, `Paiement ${receipt.receipt_number}`, user.id);
  return receiptDetail(receipt.id, user);
});
function listReceipts(query, user) {
  authorize(user, query.warehouse_id);
  return db
    .prepare(
      `SELECT r.id FROM purchase_receipts r WHERE r.warehouse_id=? ORDER BY r.receipt_date DESC,r.id DESC`,
    )
    .all(Number(query.warehouse_id))
    .map((row) => receiptDetail(row.id, user));
}
const postReceipt = db.transaction((id, user) => {
  const receipt = receiptDetail(id, user);
  if (receipt.status !== "DRAFT") {
    if (receipt.status === "CANCELLED")
      throw new PurchaseError("This receipt is cancelled", 409);
    return receipt;
  }
  if (receipt.purchase_order_id) {
    for (const line of receipt.lines) {
      const source = db
        .prepare(
          `SELECT pol.quantity ordered_quantity,
           COALESCE((SELECT SUM(prl.quantity)
             FROM purchase_receipt_lines prl
             JOIN purchase_receipts pr ON pr.id=prl.purchase_receipt_id
             WHERE prl.purchase_order_line_id=pol.id
               AND pr.status<>'CANCELLED' AND pr.id<>?),0) other_received
           FROM purchase_order_lines pol
           WHERE pol.id=? AND pol.purchase_order_id=?`,
        )
        .get(receipt.id, line.purchase_order_line_id, receipt.purchase_order_id);
      if (
        !source ||
        Number(source.other_received) + Number(line.quantity) -
          Number(source.ordered_quantity) >
          1e-9
      )
        throw new PurchaseError(
          "Received quantity exceeds remaining ordered quantity",
          409,
        );
    }
  }
  for (const line of receipt.lines) {
    if (!line.product_id) continue;
    const trace = JSON.parse(line.traceability_json || "{}");
    Inventory.receiveStock(
      {
        warehouse_id: receipt.warehouse_id,
        product_id: line.product_id,
        product_unit_id: line.product_unit_id,
        quantity: line.quantity,
        purchase_price: line.unit_price,
        ...trace,
        note: `Réception ${receipt.receipt_number}`,
      },
      user,
    );
    db.prepare(
      `UPDATE stock_movements SET reference_type='PURCHASE_RECEIPT',reference_id=? WHERE id=(SELECT id FROM stock_movements WHERE product_id=? AND warehouse_id=? AND type='RECEIPT' AND created_by=? ORDER BY id DESC LIMIT 1)`,
    ).run(String(receipt.id), line.product_id, receipt.warehouse_id, user.id);
  }
  db.prepare(
    "UPDATE purchase_receipts SET status='VALIDATED',validated_at=CURRENT_TIMESTAMP,validated_by=? WHERE id=? AND status='DRAFT'",
  ).run(user.id, receipt.id);
  if (receipt.total > 0)
    db.prepare(
      `INSERT INTO supplier_account_entries(supplier_id,purchase_receipt_id,entry_type,amount,reference,created_by)
       VALUES(?,?,'RECEIPT_DEBT',?,?,?)`,
    ).run(receipt.supplier_id, receipt.id, receipt.total, receipt.receipt_number, user.id);
  syncOrder(receipt.purchase_order_id);
  return receiptDetail(receipt.id, user);
});

const createReturn = db.transaction((receiptId, data, user) => {
  const receipt = receiptDetail(receiptId, user);
  if (receipt.status === "CANCELLED")
    throw new PurchaseError("This receipt is cancelled", 409);
  const duplicate =
    data.client_request_id &&
    db
      .prepare("SELECT id FROM supplier_returns WHERE client_request_id=?")
      .get(data.client_request_id);
  if (duplicate) return returnDetail(duplicate.id, user);
  const sources = new Map(receipt.lines.map((line) => [Number(line.id), line]));
  const rows = (data.lines || [])
    .filter((line) => Number(line.quantity) > 0)
    .map((input) => {
      const source = sources.get(Number(input.purchase_receipt_line_id)),
        qty = quantity(input.quantity);
      if (
        !source ||
        !(qty > 0) ||
        qty - Number(source.received_returnable_quantity) > 1e-9
      )
        throw new PurchaseError("Return exceeds received quantity", 409);
      if (qty - Number(source.stock_returnable_quantity) > 1e-9)
        throw new PurchaseError(
          `Return quantity exceeds currently available stock for ${source.designation}`,
          409,
        );
      return {
        source,
        quantity: qty,
        base_quantity: quantity(qty * Number(source.conversion_factor)),
        total: money(qty * Number(source.unit_price)),
        serial_numbers: (source.available_serial_numbers || []).slice(
          0,
          quantity(qty * Number(source.conversion_factor)),
        ),
      };
    });
  if (!rows.length) throw new PurchaseError("Return at least one quantity");
  const total = money(rows.reduce((sum, row) => sum + row.total, 0));
  const id = Number(
    db
      .prepare(
        `INSERT INTO supplier_returns(client_request_id,return_number,purchase_receipt_id,warehouse_id,supplier_id,return_date,total,note,created_by) VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        data.client_request_id || null,
        Settings.nextDocumentNumber("SUPPLIER_RETURN", receipt.warehouse_id),
        receipt.id,
        receipt.warehouse_id,
        receipt.supplier_id,
        data.return_date || today(),
        total,
        String(data.note || "").trim() || null,
        user.id,
      ).lastInsertRowid,
  );
  const insert = db.prepare(
    `INSERT INTO supplier_return_lines(supplier_return_id,purchase_receipt_line_id,product_id,designation,unit_name,quantity,base_quantity,unit_price,total) VALUES(?,?,?,?,?,?,?,?,?)`,
  );
  for (const row of rows) {
    insert.run(
      id,
      row.source.id,
      row.source.product_id,
      row.source.designation,
      row.source.unit_name,
      row.quantity,
      row.base_quantity,
      row.source.unit_price,
      row.total,
    );
    if (row.source.product_id) {
      const trace = JSON.parse(row.source.traceability_json || "{}");
      const product = db
        .prepare("SELECT track_batches,track_serials FROM products WHERE id=?")
        .get(row.source.product_id);
      let batchId = null;
      if (product?.track_batches && trace.batch_number)
        batchId =
          db
            .prepare(
              "SELECT id FROM stock_batches WHERE product_id=? AND warehouse_id=? AND batch_number=? AND expiration_date IS ? ORDER BY id DESC LIMIT 1",
            )
            .get(
              row.source.product_id,
              receipt.warehouse_id,
              trace.batch_number,
              trace.expiration_date || null,
            )?.id || null;
      Inventory.adjustStock(
        {
          warehouse_id: receipt.warehouse_id,
          product_id: row.source.product_id,
          product_unit_id: row.source.product_unit_id,
          quantity: row.quantity,
          direction: "out",
          batch_id: batchId,
          serial_numbers: row.serial_numbers,
          serial_out_status: "RETURNED",
          note: `Retour ${id}`,
        },
        user,
      );
      db.prepare(
        `UPDATE stock_movements SET type='SUPPLIER_RETURN',reference_type='SUPPLIER_RETURN',reference_id=? WHERE id=(SELECT id FROM stock_movements WHERE product_id=? AND warehouse_id=? AND created_by=? ORDER BY id DESC LIMIT 1)`,
      ).run(String(id), row.source.product_id, receipt.warehouse_id, user.id);
    }
  }
  db.prepare(
    `INSERT INTO supplier_account_entries(supplier_id,purchase_receipt_id,supplier_return_id,entry_type,amount,reference,created_by)
     VALUES(?,?,?,'RETURN_CREDIT',?,?,?)`,
  ).run(receipt.supplier_id, receipt.id, id, -total, receipt.receipt_number, user.id);
  const settlementMode =
    data.settlement_mode === "REFUND" ? "REFUND" : "SUPPLIER_CREDIT";
  let refundAmount = 0,
    refundMethod = null,
    cashSession = null;
  if (settlementMode === "REFUND") {
    const supplierBalance = money(
      Number(
        db.prepare("SELECT opening_balance FROM suppliers WHERE id=?").get(receipt.supplier_id)?.opening_balance || 0,
      ) +
        Number(
          db.prepare("SELECT COALESCE(SUM(amount),0) amount FROM supplier_account_entries WHERE supplier_id=?").get(receipt.supplier_id).amount,
        ),
    );
    const availableCredit = Math.max(0, -supplierBalance);
    refundAmount = money(data.refund_amount ?? Math.min(total, availableCredit));
    if (
      !(refundAmount > 0) ||
      refundAmount - total > 0.001 ||
      refundAmount - availableCredit > 0.001
    )
      throw new PurchaseError(
        "Supplier refund exceeds the available credit",
        409,
      );
    refundMethod = db
      .prepare("SELECT * FROM payment_methods WHERE code=? AND is_active=1")
      .get(data.refund_payment_method_code || "CASH");
    if (!refundMethod)
      throw new PurchaseError("Payment method is unavailable", 409);
    if (refundMethod.affects_cash_drawer) {
      cashSession = db
        .prepare(
          `SELECT cs.* FROM cash_sessions cs JOIN cash_registers cr ON cr.id=cs.cash_register_id
           WHERE cs.user_id=? AND cs.status='open' AND cr.warehouse_id=?`,
        )
        .get(user.id, receipt.warehouse_id);
      if (!cashSession)
        throw new PurchaseError(
          "An open cash session is required for a cash supplier refund",
          409,
        );
    }
    db.prepare(
      "UPDATE supplier_returns SET settlement_mode='REFUND',refund_amount=?,refund_payment_method_code=?,cash_session_id=? WHERE id=?",
    ).run(refundAmount, refundMethod.code, cashSession?.id || null, id);
    db.prepare(
      `INSERT INTO supplier_account_entries(supplier_id,purchase_receipt_id,supplier_return_id,entry_type,amount,reference,created_by)
      VALUES(?,?,?,'ADJUSTMENT',?,?,?)`,
    ).run(
      receipt.supplier_id,
      receipt.id,
      id,
      refundAmount,
      `RETURN_REFUND:${id}`,
      user.id,
    );
    if (refundMethod.affects_cash_drawer)
      db.prepare(
        `INSERT INTO cash_movements(cash_session_id,direction,movement_type,amount,reference_type,reference_id,note,created_by)
         VALUES(?,'IN','MANUAL_CASH_IN',?,'SUPPLIER_RETURN',?,?,?)`,
      ).run(
        cashSession.id,
        refundAmount,
        id,
        `Remboursement fournisseur ${id}`,
        user.id,
      );
  } else {
    db.prepare(
      "UPDATE supplier_returns SET settlement_mode='SUPPLIER_CREDIT',refund_amount=0 WHERE id=?",
    ).run(id);
  }
  if (refundAmount > 0)
    db.prepare(
      `INSERT OR IGNORE INTO financial_transactions(direction,party_type,supplier_id,payment_method_code,amount,source_type,supplier_return_id,cash_session_id,created_by)
    VALUES('IN','SUPPLIER',?,?,?,?,?,?,?)`,
    ).run(
      receipt.supplier_id,
      refundMethod.code,
      refundAmount,
      "SUPPLIER_RETURN_REFUND",
      id,
      cashSession?.id || null,
      user.id,
    );
  return returnDetail(id, user);
});
function returnDetail(id, user) {
  const result = db
    .prepare(
      `SELECT r.*,s.name supplier_name,s.phone supplier_phone,s.email supplier_email,s.address supplier_address,s.nif supplier_nif,s.nis supplier_nis,s.rib supplier_rib,s.tax_article supplier_tax_article,s.commercial_register supplier_commercial_register,s.business_activity supplier_business_activity,pr.receipt_number,w.name warehouse_name,w.phone warehouse_phone,w.email warehouse_email,w.address warehouse_address,w.nif warehouse_nif,w.nis warehouse_nis,w.rib warehouse_rib,w.tax_article warehouse_tax_article,w.commercial_register warehouse_commercial_register,w.business_activity warehouse_business_activity FROM supplier_returns r JOIN suppliers s ON s.id=r.supplier_id JOIN purchase_receipts pr ON pr.id=r.purchase_receipt_id JOIN warehouses w ON w.id=r.warehouse_id WHERE r.id=?`,
    )
    .get(Number(id));
  if (!result) throw new PurchaseError("Supplier return not found", 404);
  authorize(user, result.warehouse_id);
  result.lines = db
    .prepare(
      "SELECT * FROM supplier_return_lines WHERE supplier_return_id=? ORDER BY id",
    )
    .all(result.id);
  return result;
}
function listReturns(query, user) {
  authorize(user, query.warehouse_id);
  return db
    .prepare(
      "SELECT id FROM supplier_returns WHERE warehouse_id=? ORDER BY return_date DESC,id DESC",
    )
    .all(Number(query.warehouse_id))
    .map((row) => returnDetail(row.id, user));
}

module.exports = {
  PurchaseError,
  context,
  createSupplier,
  createOrder,
  orderDetail,
  listOrders,
  createReceipt,
  updateReceipt,
  addReceiptPayment,
  receiptDetail,
  listReceipts,
  createReturn,
  returnDetail,
  listReturns,
};
