const db = require("../config/database");
const Product = require("../models/product.model");
const Customer = require("../models/customer.model");
const Supplier = require("../models/supplier.model");
const Unit = require("../models/unit.model");
const Inventory = require("./inventory.service");
const Settings = require("./settings.service");
const { validatePartner } = require("../utils/partner");

class ExchangeError extends Error {
  constructor(message, status = 400, details = null) { super(message); this.status = status; this.details = details; }
}
const entities = {
  products: ["designation", "reference", "category", "unit", "purchase_price", "selling_price", "min_stock", "track_stock", "track_serials", "track_batches", "track_expiration", "active"],
  customers: ["name", "phone", "email", "nif", "nis", "rib", "tax_article", "commercial_register", "address", "business_activity", "opening_balance", "active"],
  suppliers: ["name", "phone", "email", "nif", "nis", "rib", "tax_article", "commercial_register", "address", "business_activity", "opening_balance", "active"],
  initial_stock: ["product_reference", "warehouse", "quantity", "serial_numbers", "batch_number", "expiration_date", "purchase_price"],
};
const aliases = {
  designation: ["designation", "désignation", "produit"], reference: ["reference", "référence"], category: ["category", "catégorie"], unit: ["unit", "unité"],
  purchase_price: ["purchase_price", "prix_achat"], selling_price: ["selling_price", "prix_vente"], min_stock: ["min_stock", "stock_minimum"],
  track_stock: ["track_stock", "suivi_stock"], track_serials: ["track_serials", "suivi_séries"], track_batches: ["track_batches", "suivi_lots"], track_expiration: ["track_expiration", "suivi_péremption"],
  active: ["active", "actif"], name: ["name", "nom"], phone: ["phone", "téléphone"], email: ["email", "e-mail"], nif: ["nif"], nis: ["nis"], rib: ["rib", "bank_account"], tax_article: ["tax_article", "article_imposition"], commercial_register: ["commercial_register", "rc"], address: ["address", "adresse"], business_activity: ["business_activity", "activité"], opening_balance: ["opening_balance", "solde_initial"],
  product_reference: ["product_reference", "référence_produit"], warehouse: ["warehouse", "entrepôt"], quantity: ["quantity", "quantité"], serial_numbers: ["serial_numbers", "numéros_série"], batch_number: ["batch_number", "lot"], expiration_date: ["expiration_date", "péremption"],
};
function canManage(user) { if (!["admin", "manager"].includes(user?.role)) throw new ExchangeError("Import is restricted to administrators and managers", 403); }
function key(value) { return String(value || "").trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_"); }
function csvRows(content) {
  const text = String(content || "").replace(/^\uFEFF/, "");
  if (!text.trim()) throw new ExchangeError("The CSV file is empty");
  const first = text.split(/\r?\n/, 1)[0], delimiter = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim()); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell.trim()); if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}
function splitSqlValues(source) {
  const values = [];
  let value = "", quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
    if (char === "'" && quoted && next === "'") { value += "''"; index += 1; }
    else if (char === "'") { quoted = !quoted; value += char; }
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  if (quoted) throw new ExchangeError("The SQL file contains an unterminated string");
  values.push(value.trim());
  return values;
}
function sqlValue(value) {
  const text = String(value || "").trim();
  if (/^null$/i.test(text)) return "";
  if (/^'(?:''|[^'])*'$/.test(text)) return text.slice(1, -1).replace(/''/g, "'");
  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return text;
  throw new ExchangeError("The SQL import accepts only literal INSERT values");
}
function sqlMatrix(entity, content) {
  const text = String(content || "").replace(/^\uFEFF/, "");
  if (!text.trim()) throw new ExchangeError("The SQL file is empty");
  const pattern = /INSERT\s+INTO\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w]*))\s*\(([^)]+)\)\s*VALUES\s*\(((?:[^';]|'(?:''|[^'])*)*)\)\s*;/gi;
  const statements = [];
  let match;
  while ((match = pattern.exec(text))) {
    const table = match[1] || match[2] || match[3] || match[4];
    if (key(table) !== key(entity)) throw new ExchangeError(`SQL table ${table} does not match import type ${entity}`);
    const columns = match[5].split(",").map((column) => column.trim().replace(/^["`\[]|["`\]]$/g, ""));
    const values = splitSqlValues(match[6]).map(sqlValue);
    if (columns.length !== values.length) throw new ExchangeError("SQL INSERT columns and values do not match");
    statements.push({ columns, values, source: match[0] });
  }
  const remainder = statements.reduce((value, statement) => value.replace(statement.source, ""), text)
    .replace(/--[^\r\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (remainder || !statements.length) throw new ExchangeError("Only INSERT statements generated by POS Modern are supported");
  const headers = [...new Set(statements.flatMap((statement) => statement.columns))];
  return [headers, ...statements.map((statement) => headers.map((header) => {
    const index = statement.columns.findIndex((column) => key(column) === key(header));
    return index < 0 ? "" : statement.values[index];
  }))];
}
function normalizedRows(entity, content, format = "csv") {
  const expected = entities[entity]; if (!expected) throw new ExchangeError("Unsupported import type", 404);
  const selectedFormat = format === "sql" || (/^\s*(?:--[^\n]*\n\s*)*INSERT\s+/i.test(String(content || ""))) ? "sql" : "csv";
  const matrix = selectedFormat === "sql" ? sqlMatrix(entity, content) : csvRows(content), rawHeaders = matrix.shift() || [];
  const headerMap = new Map();
  rawHeaders.forEach((header, index) => {
    const normalized = key(header);
    const canonical = expected.find((field) => (aliases[field] || [field]).some((alias) => key(alias) === normalized));
    if (canonical) headerMap.set(canonical, index);
  });
  const required = entity === "products" ? ["designation"] : entity === "initial_stock" ? ["product_reference", "warehouse", "quantity"] : ["name"];
  const missing = required.filter((field) => !headerMap.has(field));
  if (missing.length) throw new ExchangeError(`Missing required columns: ${missing.join(", ")}`);
  return matrix.map((values, index) => ({ row_number: index + 2, ...Object.fromEntries(expected.map((field) => [field, headerMap.has(field) ? values[headerMap.get(field)] || "" : ""])) }));
}
const number = (value, label, row, minimum = 0) => { const result = Number(String(value || "0").replace(",", ".")); if (!Number.isFinite(result) || result < minimum) throw new ExchangeError(`Row ${row}: ${label} is invalid`); return result; };
const bool = (value, fallback = false) => { if (value === "") return fallback; return ["1", "true", "yes", "oui", "actif"].includes(key(value)); };
function validateRow(entity, input) {
  const errors = [], row = { ...input };
  try {
    if (entity === "products") {
      row.designation = String(row.designation).trim(); if (!row.designation) throw new ExchangeError(`Row ${row.row_number}: designation is required`);
      row.purchase_price = number(row.purchase_price, "purchase price", row.row_number); row.selling_price = number(row.selling_price, "selling price", row.row_number); row.min_stock = number(row.min_stock, "minimum stock", row.row_number);
      row.track_stock = bool(row.track_stock, true); row.track_serials = bool(row.track_serials); row.track_batches = bool(row.track_batches); row.track_expiration = bool(row.track_expiration); row.active = bool(row.active, true);
      if (row.track_serials && row.track_batches) throw new ExchangeError(`Row ${row.row_number}: serial and batch tracking cannot be combined`);
      if (row.track_expiration) row.track_batches = true;
    } else if (["customers", "suppliers"].includes(entity)) {
      row.name = String(row.name).trim(); if (!row.name) throw new ExchangeError(`Row ${row.row_number}: name is required`);
      row.opening_balance = number(row.opening_balance, "opening balance", row.row_number, -Number.MAX_VALUE); row.active = bool(row.active, true);
    } else {
      row.quantity = number(row.quantity, "quantity", row.row_number, Number.EPSILON);
      if (row.purchase_price !== "") row.purchase_price = number(row.purchase_price, "purchase price", row.row_number);
      if (row.expiration_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.expiration_date)) throw new ExchangeError(`Row ${row.row_number}: expiration date must use YYYY-MM-DD`);
    }
  } catch (error) { errors.push(error.message); }
  return { row, errors };
}
function validateReferences(entity, row, user) {
  const errors = [];
  try {
    if (entity === "products") {
      if (!findUnit(row.unit)) throw new ExchangeError(`Row ${row.row_number}: unit does not exist`);
      if (row.category && !findCategory(row.category)) throw new ExchangeError(`Row ${row.row_number}: category does not exist`);
    }
    if (entity === "initial_stock") {
      const product = db.prepare(`SELECT p.*,pu.conversion_factor FROM products p JOIN product_units pu ON pu.product_id=p.id AND pu.is_base=1 WHERE p.reference=? COLLATE NOCASE AND p.is_active=1`).get(row.product_reference);
      if (!product) throw new ExchangeError(`Row ${row.row_number}: product reference does not exist`);
      if (!product.track_stock) throw new ExchangeError(`Row ${row.row_number}: product does not track stock`);
      const warehouse = db.prepare("SELECT id FROM warehouses WHERE name=? COLLATE NOCASE AND is_active=1").get(row.warehouse);
      if (!warehouse) throw new ExchangeError(`Row ${row.row_number}: warehouse does not exist`);
      const allowed = new Set((user.warehouse_ids?.length ? user.warehouse_ids : [user.warehouse_id]).filter(Boolean).map(Number));
      if (user.role !== "admin" && !allowed.has(Number(warehouse.id))) throw new ExchangeError(`Row ${row.row_number}: warehouse is unauthorized`);
      const baseQuantity = Number(row.quantity) * Number(product.conversion_factor || 1);
      const serials = String(row.serial_numbers || "").split(/[|,;]+/).map((value) => value.trim()).filter(Boolean);
      if (product.track_serials && (!Number.isInteger(baseQuantity) || serials.length !== baseQuantity)) throw new ExchangeError(`Row ${row.row_number}: each stock unit requires one serial number`);
      if (product.track_serials && new Set(serials.map((value) => value.toLocaleLowerCase())).size !== serials.length) throw new ExchangeError(`Row ${row.row_number}: duplicate serial numbers are not allowed`);
      if (product.track_batches && !String(row.batch_number || "").trim()) throw new ExchangeError(`Row ${row.row_number}: batch or lot number is required`);
      if (product.track_expiration && !row.expiration_date) throw new ExchangeError(`Row ${row.row_number}: expiration date is required`);
    }
  } catch (error) { errors.push(error.message); }
  return errors;
}
function preview(entity, content, user, format = "csv") {
  canManage(user);
  const rows = normalizedRows(entity, content, format).map((row) => {
    const validated = validateRow(entity, row);
    if (!validated.errors.length) validated.errors.push(...validateReferences(entity, validated.row, user));
    return validated;
  });
  return { entity, columns: entities[entity], rows: rows.slice(0, 100).map(({ row, errors }) => ({ ...row, errors })), total: rows.length, valid_count: rows.filter((item) => !item.errors.length).length, error_count: rows.filter((item) => item.errors.length).length };
}
function findUnit(name) { const text = String(name || "").trim(); return text ? db.prepare("SELECT * FROM units WHERE is_active=1 AND (name=? COLLATE NOCASE OR symbol=? COLLATE NOCASE)").get(text, text) : Unit.findGeneric(); }
function findCategory(name) { const text = String(name || "").trim(); return text ? db.prepare("SELECT * FROM categories WHERE is_active=1 AND name=? COLLATE NOCASE").get(text) : null; }
function saveProduct(row, policy, user) {
  const existing = row.reference ? db.prepare("SELECT id FROM products WHERE reference=? COLLATE NOCASE").get(row.reference) : null;
  if (existing && policy === "skip") return "skipped";
  if (existing && policy === "error") throw new ExchangeError(`Row ${row.row_number}: product reference already exists`);
  const unit = findUnit(row.unit); if (!unit) throw new ExchangeError(`Row ${row.row_number}: unit does not exist`);
  const category = findCategory(row.category); if (row.category && !category) throw new ExchangeError(`Row ${row.row_number}: category does not exist`);
  if (existing) {
    db.prepare(`UPDATE products SET designation=?,category_id=?,purchase_price=?,selling_price=?,min_stock=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(row.designation, category?.id || null, row.purchase_price, row.selling_price, row.min_stock, +row.active, existing.id);
    db.prepare("UPDATE product_units SET purchase_price=?,selling_price=?,is_active=? WHERE product_id=? AND is_base=1").run(row.purchase_price, row.selling_price, +row.active, existing.id);
    return "updated";
  }
  Product.create({ designation: row.designation, reference: row.reference || null, image_data: null, category_id: category?.id || null, min_stock: row.min_stock, track_stock: row.track_stock || row.track_batches || row.track_serials, track_batches: row.track_batches, track_expiration: row.track_expiration, track_serials: row.track_serials, description: null, is_active: row.active, created_by: user.id, initial_stock: [], product_units: [{ unit_id: unit.id, conversion_factor: 1, purchase_price: row.purchase_price, selling_price: row.selling_price, is_base: true, is_active: true, barcodes: [] }] });
  return "created";
}
function savePartner(entity, row, policy) {
  const Model = entity === "customers" ? Customer : Supplier;
  const table = entity;
  const existing = db.prepare(`SELECT id FROM ${table} WHERE name=? COLLATE NOCASE AND COALESCE(phone,'')=COALESCE(?, '')`).get(row.name, row.phone || null);
  if (existing && policy === "skip") return "skipped";
  if (existing && policy === "error") throw new ExchangeError(`Row ${row.row_number}: partner already exists`);
  const validated = validatePartner({ ...row, is_active: row.active }, entity === "customers" ? "Customer" : "Supplier");
  if (validated.error) throw new ExchangeError(`Row ${row.row_number}: ${validated.error}`);
  if (existing) { Model.update(existing.id, validated.value); return "updated"; }
  Model.create(validated.value); return "created";
}
function saveStock(row, user) {
  const product = db.prepare(`SELECT p.*,pu.id product_unit_id FROM products p JOIN product_units pu ON pu.product_id=p.id AND pu.is_base=1 WHERE p.reference=? COLLATE NOCASE AND p.is_active=1`).get(row.product_reference);
  if (!product) throw new ExchangeError(`Row ${row.row_number}: product reference does not exist`);
  const warehouse = db.prepare("SELECT id FROM warehouses WHERE name=? COLLATE NOCASE AND is_active=1").get(row.warehouse);
  if (!warehouse) throw new ExchangeError(`Row ${row.row_number}: warehouse does not exist`);
  const allowed = new Set((user.warehouse_ids?.length ? user.warehouse_ids : [user.warehouse_id]).filter(Boolean).map(Number));
  if (user.role !== "admin" && !allowed.has(Number(warehouse.id))) throw new ExchangeError(`Row ${row.row_number}: warehouse is unauthorized`, 403);
  const serials = String(row.serial_numbers || "").split(/[|,;]+/).map((value) => value.trim()).filter(Boolean);
  Inventory.receiveStock({ warehouse_id: warehouse.id, product_id: product.id, product_unit_id: product.product_unit_id, quantity: row.quantity, serial_numbers: serials, batch_number: row.batch_number || null, expiration_date: row.expiration_date || null, purchase_price: row.purchase_price === "" ? null : row.purchase_price, note: "Import stock initial" }, user);
  return "created";
}
const commitTransaction = db.transaction((entity, rows, policy, user) => {
  const summary = { created: 0, updated: 0, skipped: 0 };
  for (const item of rows) {
    const validated = validateRow(entity, item); if (validated.errors.length) throw new ExchangeError(validated.errors[0]);
    const result = entity === "products" ? saveProduct(validated.row, policy, user) : ["customers", "suppliers"].includes(entity) ? savePartner(entity, validated.row, policy) : saveStock(validated.row, user);
    summary[result] += 1;
  }
  return summary;
});
function commit(entity, content, policy, user, format = "csv") { canManage(user); if (!["error", "skip", "update"].includes(policy)) throw new ExchangeError("Duplicate policy is invalid"); const rows = normalizedRows(entity, content, format); const result = commitTransaction(entity, rows, policy, user); return { entity, total: rows.length, ...result }; }
function template(entity, user, format = "csv") { canManage(user); if (!entities[entity]) throw new ExchangeError("Unsupported import type", 404); const example = { products: ["Clavier USB fictif","TECH-001","Périphériques","Unité","1500","2200","3","oui","non","non","non","oui"], customers: ["Client Démo SARL","0550000000","client@example.test","000000000000000","","00799999000000000001","","","Adresse fictive","Commerce","0","oui"], suppliers: ["Fournisseur Démo SARL","0550000001","supplier@example.test","000000000000001","","00799999000000000002","","","Adresse fictive","Distribution","0","oui"], initial_stock: ["TECH-001","Entrepôt principal","10","","","","1500"] }[entity]; if (format === "sql") return sqlDocument(entity, entities[entity], [Object.fromEntries(entities[entity].map((column, index) => [column, example[index]]))]); return `${entities[entity].join(";")}\r\n${example.join(";")}\r\n`; }
const exportQueries = {
  products: `SELECT p.reference,p.designation,c.name category,u.name unit,pu.purchase_price,pu.selling_price,p.min_stock,p.track_stock,p.track_serials,p.track_batches,p.track_expiration,p.is_active active,COALESCE((SELECT SUM(ps.quantity) FROM product_stock ps WHERE ps.product_id=p.id AND (@warehouse IS NULL OR ps.warehouse_id=@warehouse)),0) stock_quantity FROM products p LEFT JOIN categories c ON c.id=p.category_id JOIN product_units pu ON pu.product_id=p.id AND pu.is_base=1 JOIN units u ON u.id=pu.unit_id WHERE (@search='' OR fuzzy_match(@search,p.designation,p.reference,c.name,(SELECT group_concat(pb.barcode,' ') FROM product_barcodes pb WHERE pb.product_id=p.id))=1) AND (@activeStatus='all' OR p.is_active=CASE @activeStatus WHEN 'active' THEN 1 ELSE 0 END) AND (@category IS NULL OR p.category_id=@category) ORDER BY p.designation`,
  stock: `SELECT w.name warehouse,p.reference,p.designation,c.name category,u.name unit,ROUND(COALESCE(ps.quantity,0),3) quantity,p.min_stock,CASE WHEN p.track_stock=0 THEN 'NOT_TRACKED' WHEN COALESCE(ps.quantity,0)<=0 THEN 'OUT' WHEN p.min_stock>0 AND COALESCE(ps.quantity,0)<=p.min_stock THEN 'LOW' ELSE 'OK' END stock_status FROM products p JOIN warehouses w ON w.is_active=1 AND (@warehouse IS NULL OR w.id=@warehouse) LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=w.id LEFT JOIN categories c ON c.id=p.category_id JOIN product_units pu ON pu.product_id=p.id AND pu.is_base=1 JOIN units u ON u.id=pu.unit_id WHERE p.is_active=1 AND (@search='' OR fuzzy_match(@search,p.designation,p.reference,c.name)=1) AND (@documentStatus='' OR @documentStatus='all' OR (@documentStatus='attention' AND p.track_stock=1 AND p.min_stock>0 AND COALESCE(ps.quantity,0)<=p.min_stock) OR (@documentStatus='low' AND p.track_stock=1 AND COALESCE(ps.quantity,0)>0 AND COALESCE(ps.quantity,0)<=p.min_stock) OR (@documentStatus='out' AND p.track_stock=1 AND COALESCE(ps.quantity,0)<=0) OR (@documentStatus='expired' AND p.track_stock=1 AND EXISTS(SELECT 1 FROM stock_batches sb WHERE sb.product_id=p.id AND sb.warehouse_id=w.id AND sb.quantity>0 AND sb.expiration_date<date('now'))) OR (@documentStatus='expiring' AND p.track_stock=1 AND EXISTS(SELECT 1 FROM stock_batches sb WHERE sb.product_id=p.id AND sb.warehouse_id=w.id AND sb.quantity>0 AND sb.expiration_date BETWEEN date('now') AND date('now',@warningModifier)))) ORDER BY p.designation,w.name`,
  customers: `SELECT name,phone,email,nif,nis,rib,tax_article,commercial_register,address,business_activity,opening_balance,is_active active FROM customers WHERE (@search='' OR fuzzy_match(@search,name,phone,email,nif,nis,rib,tax_article,commercial_register,address,business_activity)=1) AND (@activeStatus='all' OR is_active=CASE @activeStatus WHEN 'active' THEN 1 ELSE 0 END) ORDER BY name`,
  suppliers: `SELECT name,phone,email,nif,nis,rib,tax_article,commercial_register,address,business_activity,opening_balance,is_active active FROM suppliers WHERE (@search='' OR fuzzy_match(@search,name,phone,email,nif,nis,rib,tax_article,commercial_register,address,business_activity)=1) AND (@activeStatus='all' OR is_active=CASE @activeStatus WHEN 'active' THEN 1 ELSE 0 END) ORDER BY name`,
  sales: `SELECT s.sale_number,s.sale_date,c.name customer,s.document_type,s.fulfillment_type,s.total,s.payment_status,s.return_status FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE (@warehouse IS NULL OR s.warehouse_id=@warehouse) AND (@search='' OR fuzzy_match(@search,s.sale_number,c.name,s.customer_reference)=1) AND (@fromDate='' OR date(s.sale_date)>=date(@fromDate)) AND (@toDate='' OR date(s.sale_date)<=date(@toDate)) AND (@customer IS NULL OR s.customer_id=@customer) AND (@paymentMethod='' OR EXISTS(SELECT 1 FROM sale_payments sp WHERE sp.sale_id=s.id AND sp.payment_method_code=@paymentMethod)) ORDER BY s.sale_date DESC,s.id DESC`,
  quotes: `SELECT q.quote_number,q.quote_date,q.valid_until,c.name customer,q.total,q.status FROM quotes q LEFT JOIN customers c ON c.id=q.customer_id WHERE (@warehouse IS NULL OR q.warehouse_id=@warehouse) AND (@search='' OR fuzzy_match(@search,q.quote_number,c.name,q.customer_reference)=1) AND (@fromDate='' OR date(q.quote_date)>=date(@fromDate)) AND (@toDate='' OR date(q.quote_date)<=date(@toDate)) AND (@documentStatus='' OR q.status=@documentStatus) ORDER BY q.quote_date DESC,q.id DESC`,
  purchase_orders: `SELECT o.order_number,o.order_date,s.name supplier,o.status,COALESCE((SELECT SUM(l.total) FROM purchase_order_lines l WHERE l.purchase_order_id=o.id),0) total FROM purchase_orders o JOIN suppliers s ON s.id=o.supplier_id WHERE (@warehouse IS NULL OR o.warehouse_id=@warehouse) AND (@search='' OR fuzzy_match(@search,o.order_number,s.name)=1) AND (@fromDate='' OR date(o.order_date)>=date(@fromDate)) AND (@toDate='' OR date(o.order_date)<=date(@toDate)) AND (@documentStatus='' OR o.status=@documentStatus) ORDER BY o.order_date DESC,o.id DESC`,
  purchase_receipts: `SELECT r.receipt_number,r.receipt_date,o.order_number,s.name supplier,r.status,COALESCE((SELECT SUM(l.total) FROM purchase_receipt_lines l WHERE l.purchase_receipt_id=r.id),0) total FROM purchase_receipts r LEFT JOIN purchase_orders o ON o.id=r.purchase_order_id JOIN suppliers s ON s.id=r.supplier_id WHERE (@warehouse IS NULL OR r.warehouse_id=@warehouse) AND (@search='' OR fuzzy_match(@search,r.receipt_number,o.order_number,s.name)=1) AND (@fromDate='' OR date(r.receipt_date)>=date(@fromDate)) AND (@toDate='' OR date(r.receipt_date)<=date(@toDate)) AND (@documentStatus='' OR r.status=@documentStatus) ORDER BY r.receipt_date DESC,r.id DESC`,
  customer_invoices: `SELECT i.invoice_number,i.invoice_date,c.name customer,i.subtotal,i.tax_amount,i.stamp_amount,i.total,i.status,ROUND(COALESCE((SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id=i.id),0)+COALESCE((SELECT SUM(sp.amount) FROM invoice_sales x JOIN sale_payments sp ON sp.sale_id=x.sale_id WHERE x.invoice_id=i.id AND sp.invoice_payment_id IS NULL),0),2) paid_amount,ROUND(MAX(0,i.total-COALESCE((SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id=i.id),0)-COALESCE((SELECT SUM(sp.amount) FROM invoice_sales x JOIN sale_payments sp ON sp.sale_id=x.sale_id WHERE x.invoice_id=i.id AND sp.invoice_payment_id IS NULL),0)-COALESCE((SELECT SUM(cn.total) FROM invoice_credit_notes cn WHERE cn.invoice_id=i.id),0)),2) balance_due FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE (@warehouse IS NULL OR i.warehouse_id=@warehouse) AND (@search='' OR fuzzy_match(@search,i.invoice_number,c.name,i.note)=1) AND (@fromDate='' OR date(i.invoice_date)>=date(@fromDate)) AND (@toDate='' OR date(i.invoice_date)<=date(@toDate)) AND (@documentStatus='' OR i.status=@documentStatus) ORDER BY i.invoice_date DESC,i.id DESC`,
  transactions: `SELECT t.created_at,t.direction,t.party_type,COALESCE(c.name,s.name) partner,t.source_type,pm.name payment_method,t.amount FROM financial_transactions t LEFT JOIN customers c ON c.id=t.customer_id LEFT JOIN suppliers s ON s.id=t.supplier_id LEFT JOIN payment_methods pm ON pm.code=t.payment_method_code LEFT JOIN sale_payments sp ON sp.id=t.sale_payment_id LEFT JOIN sales sale ON sale.id=sp.sale_id LEFT JOIN invoice_payments ip ON ip.id=t.invoice_payment_id LEFT JOIN invoices i ON i.id=ip.invoice_id LEFT JOIN purchase_receipts pr ON pr.id=t.purchase_receipt_id LEFT JOIN supplier_returns sr ON sr.id=t.supplier_return_id LEFT JOIN sales_returns cr ON cr.id=t.sales_return_id WHERE (@warehouse IS NULL OR COALESCE(sale.warehouse_id,i.warehouse_id,pr.warehouse_id,sr.warehouse_id,cr.warehouse_id)=@warehouse) AND (@search='' OR fuzzy_match(@search,c.name,s.name,t.source_type,pm.name,t.payment_method_code,sale.sale_number,i.invoice_number,pr.receipt_number,sr.return_number,cr.return_number)=1) AND (@fromDate='' OR date(t.created_at)>=date(@fromDate)) AND (@toDate='' OR date(t.created_at)<=date(@toDate)) ORDER BY t.created_at DESC,t.id DESC`,
  customer_payments: `SELECT t.created_at,COALESCE(c.name,'') customer,t.source_type,pm.name payment_method,t.amount FROM financial_transactions t JOIN customers c ON c.id=t.customer_id LEFT JOIN payment_methods pm ON pm.code=t.payment_method_code LEFT JOIN sale_payments sp ON sp.id=t.sale_payment_id LEFT JOIN sales sale ON sale.id=sp.sale_id LEFT JOIN invoice_payments ip ON ip.id=t.invoice_payment_id LEFT JOIN invoices i ON i.id=ip.invoice_id WHERE t.direction='IN' AND t.source_type IN ('SALE_PAYMENT','INVOICE_PAYMENT') AND (@warehouse IS NULL OR COALESCE(sale.warehouse_id,i.warehouse_id)=@warehouse) AND (@search='' OR fuzzy_match(@search,c.name,t.source_type,pm.name,t.payment_method_code)=1) AND (@fromDate='' OR date(t.created_at)>=date(@fromDate)) AND (@toDate='' OR date(t.created_at)<=date(@toDate)) ORDER BY t.created_at DESC,t.id DESC`,
  cash_movements: `SELECT m.created_at,cr.name cash_register,u.name user,m.direction,m.movement_type,m.amount,m.reference_type,m.reference_id,m.note FROM cash_movements m JOIN cash_sessions cs ON cs.id=m.cash_session_id JOIN cash_registers cr ON cr.id=cs.cash_register_id JOIN users u ON u.id=cs.user_id WHERE (@warehouse IS NULL OR cr.warehouse_id=@warehouse) AND (@cashRegister IS NULL OR cr.id=@cashRegister) AND (@userId IS NULL OR cs.user_id=@userId) AND (@fromDate='' OR date(m.created_at)>=date(@fromDate)) AND (@toDate='' OR date(m.created_at)<=date(@toDate)) ORDER BY m.created_at DESC,m.id DESC`,
  stock_movements: `SELECT m.created_at,w.name warehouse,p.reference,p.designation,m.type,m.quantity,m.reference_type,m.reference_id,m.note FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN warehouses w ON w.id=m.warehouse_id WHERE (@warehouse IS NULL OR m.warehouse_id=@warehouse) AND (@search='' OR fuzzy_match(@search,p.designation,p.reference,m.type,m.reference_type,m.reference_id,m.note)=1) AND (@documentStatus='' OR m.type=@documentStatus) AND (@fromDate='' OR date(m.created_at)>=date(@fromDate)) AND (@toDate='' OR date(m.created_at)<=date(@toDate)) ORDER BY m.created_at DESC,m.id DESC`,
};
function escapeCsv(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function escapeSql(value) { return value == null ? "NULL" : `'${String(value).replace(/'/g, "''")}'`; }
function sqlDocument(entity, columns, rows) {
  const identifiers = columns.map((column) => `"${String(column).replace(/"/g, '""')}"`).join(", ");
  const statements = rows.map((row) => `INSERT INTO "${entity}" (${identifiers}) VALUES (${columns.map((column) => escapeSql(row[column])).join(", ")});`);
  return [`-- POS Modern SQL data exchange: ${entity}`, "-- Import this file through POS Modern; do not execute it directly.", ...statements].join("\r\n");
}
function reportCsv(query, user) {
  const data = require("./analytics.service").report(query, user);
  const rows = [
    ["report", data.category],
    ["start", data.filters.start],
    ["end", data.filters.end],
    ["warehouse_id", data.filters.warehouseId ?? ""],
    ["customer_id", data.filters.customerId ?? ""],
    ["supplier_id", data.filters.supplierId ?? ""],
    [],
    ["indicator", "value"],
  ];
  for (const [key, value] of Object.entries(data.overview || {}))
    rows.push([key, value]);
  for (const [group, content] of Object.entries(data)) {
    if (!content || typeof content !== "object" || ["filters", "overview"].includes(group)) continue;
    for (const [section, values] of Object.entries(content)) {
      if (!Array.isArray(values)) continue;
      rows.push([], [group, section]);
      const columns = [...new Set(values.flatMap((row) => Object.keys(row)))];
      rows.push(columns);
      values.forEach((row) => rows.push(columns.map((column) => row[column])));
    }
  }
  return rows.map((row) => row.map(escapeCsv).join(";")).join("\r\n");
}
function exportCsv(entity, query, user) {
  if (entity === "report") return reportCsv(query, user);
  const sql = exportQueries[entity];
  if (!sql) throw new ExchangeError("Unsupported export type", 404);
  const requested = Number(query.warehouse_id || 0) || null;
  const allowed = new Set((user.warehouse_ids?.length ? user.warehouse_ids : [user.warehouse_id]).filter(Boolean).map(Number));
  if (requested && user.role !== "admin" && !allowed.has(requested))
    throw new ExchangeError("Warehouse is unauthorized", 403);
  const effectiveWarehouse = requested || (user.role === "admin" ? null : allowed.values().next().value || null);
  const search = String(query.search || "").trim();
  const rawStatus = String(query.status || "").trim();
  const rows = db.prepare(sql).all({
    warehouse: effectiveWarehouse,
    search,
    activeStatus: ["active", "inactive", "all"].includes(rawStatus) ? rawStatus : "all",
    documentStatus: ["active", "inactive", "all"].includes(rawStatus) ? "" : rawStatus,
    category: Number(query.category_id || 0) || null,
    customer: Number(query.customer_id || 0) || null,
    supplier: Number(query.supplier_id || 0) || null,
    paymentMethod: String(query.payment_method_code || "").trim(),
    cashRegister: Number(query.cash_register_id || 0) || null,
    userId: Number(query.user_id || 0) || null,
    warningModifier: `+${Number(Settings.getGroup("expiration").warning_days || 30)} days`,
    fromDate: String(query.from || query.start || "").trim(),
    toDate: String(query.to || query.end || "").trim(),
  });
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return [
    columns.map(escapeCsv).join(";"),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(";")),
  ].join("\r\n");
}
function exportSql(entity, query, user) {
  if (entity === "report") throw new ExchangeError("SQL export is unavailable for reports", 400);
  const csv = exportCsv(entity, query, user);
  if (!csv.trim()) return sqlDocument(entity, [], []);
  const matrix = csvRows(csv);
  const columns = matrix.shift() || [];
  const rows = matrix.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""])));
  return sqlDocument(entity, columns, rows);
}
module.exports = { ExchangeError, preview, commit, template, exportCsv, exportSql };
