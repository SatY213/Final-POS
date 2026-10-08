"use strict";

const db = require("../config/database");
const Settings = require("./settings.service");

class WarrantyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function authorizeWarehouse(value, user) {
  const id = Number(value);
  const warehouse = db
    .prepare("SELECT id,name FROM warehouses WHERE id=? AND is_active=1")
    .get(id);
  if (!warehouse) throw new WarrantyError("Warehouse not found", 404);
  const allowed = (user.warehouse_ids || []).map(Number);
  if (
    user.role !== "admin" &&
    (allowed.length
      ? !allowed.includes(id)
      : user.warehouse_id != null && Number(user.warehouse_id) !== id)
  )
    throw new WarrantyError("You cannot access warranties from this warehouse", 403);
  return warehouse;
}

function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function required(value) {
  const text = clean(value);
  if (!text) throw new WarrantyError("Required warranty information is missing");
  return text;
}

function validDate(value, label) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`)))
    throw new WarrantyError(`${label} is invalid`);
  return text;
}

function endDate(saleDate, durationValue, durationUnit) {
  const [year, month, day] = saleDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (durationUnit === "DAYS") date.setUTCDate(date.getUTCDate() + durationValue);
  else {
    const targetMonth = month - 1 + durationValue;
    const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
    date.setUTCFullYear(year, targetMonth, Math.min(day, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

function validate(data, user, existing = null) {
  const warehouseId = Number(data.warehouse_id || existing?.warehouse_id);
  authorizeWarehouse(warehouseId, user);
  const durationValue = Number(data.duration_value);
  const durationUnit = data.duration_unit === "DAYS" ? "DAYS" : data.duration_unit === "MONTHS" ? "MONTHS" : null;
  if (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 12000)
    throw new WarrantyError("Warranty duration is invalid");
  if (!durationUnit) throw new WarrantyError("Warranty duration unit is invalid");
  const saleDate = validDate(data.sale_date, "Selling date");
  const invoicedPrice = Number(data.invoiced_price || 0);
  if (!Number.isFinite(invoicedPrice) || invoicedPrice < 0)
    throw new WarrantyError("Invoiced price is invalid");

  const customerId = data.customer_id ? Number(data.customer_id) : null;
  if (customerId && !db.prepare("SELECT 1 FROM customers WHERE id=?").get(customerId))
    throw new WarrantyError("Customer not found", 404);
  const productId = data.product_id ? Number(data.product_id) : null;
  const product = productId
    ? db.prepare("SELECT track_serials,track_batches FROM products WHERE id=?").get(productId)
    : null;
  if (productId && !product)
    throw new WarrantyError("Product not found", 404);
  const productUnitId = data.product_unit_id ? Number(data.product_unit_id) : null;
  if (
    productUnitId &&
    !db.prepare("SELECT 1 FROM product_units WHERE id=? AND product_id=?").get(productUnitId, productId)
  )
    throw new WarrantyError("Product package is invalid");

  const sourceType = data.source_type === "INVOICE" ? "INVOICE" : "SALE";
  const sourceReference = clean(data.source_reference ?? data.invoice_reference);
  const serialNumber = clean(data.serial_number);
  const batchNumber = clean(data.batch_number);
  if (product?.track_serials && !serialNumber)
    throw new WarrantyError("A serial number is required for this warranty");
  if (product?.track_batches && !batchNumber)
    throw new WarrantyError("A batch number is required for this warranty");
  const invoice = sourceType === "INVOICE" && sourceReference
    ? db.prepare("SELECT id FROM invoices WHERE invoice_number=? COLLATE NOCASE").get(sourceReference)
    : null;
  const sale = sourceType === "SALE" && sourceReference
    ? db.prepare("SELECT id FROM sales WHERE sale_number=? COLLATE NOCASE").get(sourceReference)
    : null;
  return {
    warehouse_id: warehouseId,
    customer_id: customerId,
    product_id: productId,
    product_unit_id: productUnitId,
    sale_id: sale?.id || null,
    invoice_id: invoice?.id || null,
    customer_full_name: required(data.customer_full_name),
    customer_phone: clean(data.customer_phone),
    customer_email: clean(data.customer_email),
    customer_address: clean(data.customer_address),
    product_nature: required(data.product_nature),
    product_model: clean(data.product_model),
    product_brand: clean(data.product_brand),
    serial_number: serialNumber,
    batch_number: batchNumber,
    invoiced_price: invoicedPrice,
    source_type: sourceType,
    source_reference: sourceReference,
    invoice_reference: sourceType === "INVOICE" ? sourceReference : null,
    sale_date: saleDate,
    duration_value: durationValue,
    duration_unit: durationUnit,
    warranty_end_date: endDate(saleDate, durationValue, durationUnit),
    note: clean(data.note),
  };
}

function list(query, user) {
  const warehouse = authorizeWarehouse(query.warehouse_id, user);
  const where = ["w.warehouse_id=@warehouse"];
  const params = { warehouse: warehouse.id };
  if (query.search) {
    where.push("fuzzy_match(@search,w.warranty_number,w.customer_full_name,w.customer_phone,w.product_nature,w.product_model,w.product_brand,w.serial_number,w.batch_number,w.source_reference,w.invoice_reference)=1");
    params.search = String(query.search).trim();
  }
  if (query.status === "ACTIVE") where.push("date(w.warranty_end_date)>=date('now','localtime')");
  if (query.status === "EXPIRED") where.push("date(w.warranty_end_date)<date('now','localtime')");
  if (query.from) { where.push("w.sale_date>=@from"); params.from = query.from; }
  if (query.to) { where.push("w.sale_date<=@to"); params.to = query.to; }
  const sqlWhere = where.join(" AND ");
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(query.limit, 10) || 25));
  const total = Number(db.prepare(`SELECT COUNT(*) count FROM warranties w WHERE ${sqlWhere}`).get(params).count);
  const items = db.prepare(
    `SELECT w.*,u.name created_by_name,
      CASE WHEN date(w.warranty_end_date)>=date('now','localtime') THEN 'ACTIVE' ELSE 'EXPIRED' END status
     FROM warranties w JOIN users u ON u.id=w.created_by
     WHERE ${sqlWhere}
     ORDER BY w.sale_date DESC,w.id DESC LIMIT @limit OFFSET @offset`,
  ).all({ ...params, limit, offset: (page - 1) * limit });
  return {
    items,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

function context(query, user) {
  const warehouse = authorizeWarehouse(query.warehouse_id, user);
  const products = db.prepare(
    `SELECT p.id,p.designation,p.reference,p.track_serials,p.track_batches,p.track_expiration,
      pu.id product_unit_id,pu.selling_price,u.name unit_name
     FROM products p JOIN product_units pu ON pu.product_id=p.id AND pu.is_base=1
     JOIN units u ON u.id=pu.unit_id WHERE p.is_active=1 ORDER BY p.designation COLLATE NOCASE`,
  ).all().map((product) => ({
    ...product,
    serials: product.track_serials
      ? db.prepare("SELECT serial_number,status FROM stock_serials WHERE product_id=? AND warehouse_id=? ORDER BY serial_number COLLATE NOCASE").all(product.id, warehouse.id)
      : [],
    batches: product.track_batches
      ? db.prepare("SELECT DISTINCT batch_number,expiration_date FROM stock_batches WHERE product_id=? AND warehouse_id=? AND batch_number IS NOT NULL ORDER BY received_at DESC").all(product.id, warehouse.id)
      : [],
  }));
  const addTraceability = (line) => ({
    ...line,
    serial_numbers: line.product_id
      ? db.prepare(
        `SELECT ss.serial_number FROM sale_serial_allocations sa
         JOIN stock_serials ss ON ss.id=sa.serial_id
         WHERE sa.sale_line_id=? ORDER BY ss.serial_number COLLATE NOCASE`,
      ).all(line.sale_line_id).map((item) => item.serial_number)
      : [],
    batch_numbers: line.product_id
      ? db.prepare(
        `SELECT DISTINCT sb.batch_number FROM sale_batch_allocations ba
         JOIN stock_batches sb ON sb.id=ba.batch_id
         WHERE ba.sale_line_id=? AND sb.batch_number IS NOT NULL
         ORDER BY sb.batch_number COLLATE NOCASE`,
      ).all(line.sale_line_id).map((item) => item.batch_number)
      : [],
  });
  const invoices = db.prepare(
    `SELECT i.id,i.invoice_number,i.invoice_date,i.total,i.customer_id,
      c.name customer_name,c.phone customer_phone,c.email customer_email,c.address customer_address
     FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id
     WHERE i.warehouse_id=? AND i.status='ISSUED' ORDER BY i.invoice_date DESC,i.id DESC LIMIT 500`,
  ).all(warehouse.id).map((invoice) => ({
    ...invoice,
    lines: db.prepare(
      `SELECT il.sale_line_id,sl.product_id,sl.product_unit_id,il.designation,sl.reference,il.unit_price,il.total
       FROM invoice_lines il LEFT JOIN sale_lines sl ON sl.id=il.sale_line_id
       WHERE il.invoice_id=? ORDER BY il.id`,
    ).all(invoice.id).map(addTraceability),
  }));
  const sales = db.prepare(
    `SELECT s.id,s.sale_number,s.sale_date,s.total,s.customer_id,
      c.name customer_name,c.phone customer_phone,c.email customer_email,c.address customer_address
     FROM sales s LEFT JOIN customers c ON c.id=s.customer_id
     WHERE s.warehouse_id=? AND s.sale_status='CONFIRMED'
     ORDER BY s.sale_date DESC,s.id DESC LIMIT 500`,
  ).all(warehouse.id).map((sale) => ({
    ...sale,
    lines: db.prepare(
      `SELECT sl.id sale_line_id,sl.product_id,sl.product_unit_id,sl.designation,
        sl.reference,sl.unit_price,sl.total
       FROM sale_lines sl WHERE sl.sale_id=? ORDER BY sl.id`,
    ).all(sale.id).map(addTraceability),
  }));
  return {
    customers: db.prepare("SELECT id,name,phone,email,address FROM customers WHERE is_active=1 ORDER BY name COLLATE NOCASE").all(),
    products,
    sales,
    invoices,
  };
}

function detail(id, user) {
  const warranty = db.prepare(
    `SELECT w.*,wh.name warehouse_name,wh.phone warehouse_phone,wh.email warehouse_email,
      wh.address warehouse_address,wh.nif warehouse_nif,wh.nis warehouse_nis,wh.rib warehouse_rib,
      wh.tax_article warehouse_tax_article,wh.commercial_register warehouse_commercial_register,
      wh.business_activity warehouse_business_activity,u.name created_by_name,
      CASE WHEN date(w.warranty_end_date)>=date('now','localtime') THEN 'ACTIVE' ELSE 'EXPIRED' END status
     FROM warranties w JOIN warehouses wh ON wh.id=w.warehouse_id JOIN users u ON u.id=w.created_by
     WHERE w.id=?`,
  ).get(Number(id));
  if (!warranty) throw new WarrantyError("Warranty not found", 404);
  authorizeWarehouse(warranty.warehouse_id, user);
  warranty.document_number = warranty.warranty_number;
  warranty.print_profile = Settings.profiles().find(
    (profile) => profile.document_type === "WARRANTY" && profile.is_active,
  ) || null;
  return warranty;
}

const create = db.transaction((data, user) => {
  const value = validate(data, user);
  const warrantyNumber = Settings.nextDocumentNumber("WARRANTY", value.warehouse_id);
  const result = db.prepare(
    `INSERT INTO warranties(warranty_number,warehouse_id,customer_id,product_id,product_unit_id,sale_id,invoice_id,
      customer_full_name,customer_phone,customer_email,customer_address,product_nature,product_model,
      product_brand,serial_number,batch_number,invoiced_price,source_type,source_reference,invoice_reference,sale_date,duration_value,
      duration_unit,warranty_end_date,note,created_by)
     VALUES(@warranty_number,@warehouse_id,@customer_id,@product_id,@product_unit_id,@sale_id,@invoice_id,
      @customer_full_name,@customer_phone,@customer_email,@customer_address,@product_nature,@product_model,
      @product_brand,@serial_number,@batch_number,@invoiced_price,@source_type,@source_reference,@invoice_reference,@sale_date,@duration_value,
      @duration_unit,@warranty_end_date,@note,@created_by)`,
  ).run({ ...value, warranty_number: warrantyNumber, created_by: user.id });
  return detail(result.lastInsertRowid, user);
});

const update = db.transaction((id, data, user) => {
  const existing = db.prepare("SELECT * FROM warranties WHERE id=?").get(Number(id));
  if (!existing) throw new WarrantyError("Warranty not found", 404);
  authorizeWarehouse(existing.warehouse_id, user);
  const value = validate({ ...data, warehouse_id: existing.warehouse_id }, user, existing);
  db.prepare(
    `UPDATE warranties SET customer_id=@customer_id,product_id=@product_id,product_unit_id=@product_unit_id,
      sale_id=@sale_id,invoice_id=@invoice_id,customer_full_name=@customer_full_name,customer_phone=@customer_phone,
      customer_email=@customer_email,customer_address=@customer_address,product_nature=@product_nature,
      product_model=@product_model,product_brand=@product_brand,serial_number=@serial_number,
      batch_number=@batch_number,invoiced_price=@invoiced_price,source_type=@source_type,
      source_reference=@source_reference,invoice_reference=@invoice_reference,
      sale_date=@sale_date,duration_value=@duration_value,duration_unit=@duration_unit,
      warranty_end_date=@warranty_end_date,note=@note,updated_at=CURRENT_TIMESTAMP WHERE id=@id`,
  ).run({ ...value, id: existing.id });
  return detail(existing.id, user);
});

module.exports = { WarrantyError, list, context, detail, create, update, endDate };
