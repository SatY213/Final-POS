const crypto = require("node:crypto");
const db = require("../config/database");
const Settings = require("./settings.service");

class InventoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const positive = (value, label = "Quantity") => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0)
    throw new InventoryError(`${label} must be greater than zero`);
  return number;
};
function warehouse(id, user) {
  const warehouseId = Number(id);
  if (!Number.isInteger(warehouseId))
    throw new InventoryError("A valid warehouse is required");
  const row = db
    .prepare("SELECT id,name,is_active FROM warehouses WHERE id=?")
    .get(warehouseId);
  if (!row || !row.is_active)
    throw new InventoryError("Warehouse is inactive or unavailable", 403);
  if (user.role !== "admin" && Number(user.warehouse_id) !== warehouseId)
    throw new InventoryError("Warehouse is unauthorized", 403);
  return row;
}
function selection(productId, productUnitId) {
  const product = db
    .prepare(
      "SELECT id,designation,is_active,track_stock,track_batches,track_expiration,track_serials FROM products WHERE id=?",
    )
    .get(Number(productId));
  if (!product || !product.is_active)
    throw new InventoryError("Product is inactive or unavailable");
  if (!product.track_stock)
    throw new InventoryError("This product does not track stock");
  const unit = db
    .prepare(
      `SELECT pu.id,pu.product_id,pu.conversion_factor,pu.purchase_price,pu.is_active,u.name unit_name,u.symbol unit_symbol,base_u.name base_unit_name,base_u.symbol base_unit_symbol
    FROM product_units pu JOIN units u ON u.id=pu.unit_id JOIN product_units base ON base.product_id=pu.product_id AND base.is_base=1 JOIN units base_u ON base_u.id=base.unit_id WHERE pu.id=? AND pu.product_id=?`,
    )
    .get(Number(productUnitId), product.id);
  if (!unit || !unit.is_active || !(unit.conversion_factor > 0))
    throw new InventoryError("Packaging is invalid or inactive");
  return { product, unit };
}
function baseQuantity(quantity, factor) {
  const result = positive(quantity) * factor;
  if (!Number.isFinite(result) || result <= 0)
    throw new InventoryError("Converted quantity is invalid");
  return result;
}
function balance(productId, warehouseId) {
  return Number(
    db
      .prepare(
        "SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?",
      )
      .get(productId, warehouseId)?.quantity || 0,
  );
}
function changeBalance(productId, warehouseId, delta) {
  const current = balance(productId, warehouseId),
    next = current + delta;
  if (next < -1e-9) throw new InventoryError("Insufficient stock", 409);
  db.prepare(
    `INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,?) ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=excluded.quantity`,
  ).run(productId, warehouseId, Math.max(0, next));
}
function movement({
  productId,
  warehouseId,
  batchId = null,
  type,
  quantity,
  referenceType = null,
  referenceId = null,
  note = null,
  userId,
}) {
  db.prepare(
    "INSERT INTO stock_movements(product_id,warehouse_id,batch_id,type,quantity,reference_type,reference_id,note,created_by) VALUES(?,?,?,?,?,?,?,?,?)",
  ).run(
    productId,
    warehouseId,
    batchId,
    type,
    quantity,
    referenceType,
    referenceId,
    note,
    userId,
  );
}
function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
  );
}
function receiveBatch(product, warehouseId, data, quantity, conversionFactor) {
  const batchNumber = String(data.batch_number || "").trim();
  if (!batchNumber) throw new InventoryError("Batch or lot number is required");
  const expiration = String(data.expiration_date || "");
  if (product.track_expiration && !validDate(expiration))
    throw new InventoryError("A valid expiration date is required");
  const date = product.track_expiration ? expiration : null;
  const existing = db
    .prepare(
      "SELECT id FROM stock_batches WHERE product_id=? AND warehouse_id=? AND batch_number=? AND expiration_date IS ?",
    )
    .get(product.id, warehouseId, batchNumber, date);
  let price = null;
  if (data.purchase_price != null && data.purchase_price !== "") {
    price = Number(data.purchase_price);
    if (!Number.isFinite(price) || price < 0)
      throw new InventoryError("Purchase price must be zero or greater");
    price /= conversionFactor;
  }
  if (existing) {
    db.prepare(
      "UPDATE stock_batches SET quantity=quantity+?,purchase_price=COALESCE(?,purchase_price) WHERE id=?",
    ).run(quantity, price, existing.id);
    return Number(existing.id);
  }
  return Number(
    db
      .prepare(
        "INSERT INTO stock_batches(product_id,warehouse_id,batch_number,expiration_date,quantity,purchase_price) VALUES(?,?,?,?,?,?)",
      )
      .run(product.id, warehouseId, batchNumber, date, quantity, price)
      .lastInsertRowid,
  );
}
function serialInput(product,data,quantity){if(!product.track_serials)return[];if(!Number.isInteger(quantity))throw new InventoryError("Serialized quantity must be a whole number");const values=(Array.isArray(data.serial_numbers)?data.serial_numbers:String(data.serial_numbers||"").split(/[\n,;]+/)).map(value=>String(value).trim()).filter(Boolean);if(values.length!==quantity)throw new InventoryError("Each stock unit requires one serial number");if(new Set(values.map(value=>value.toLocaleLowerCase())).size!==values.length)throw new InventoryError("Duplicate serial numbers are not allowed");return values;}
function insertSerials(product,warehouseId,values){const insert=db.prepare("INSERT INTO stock_serials(product_id,warehouse_id,serial_number,status) VALUES(?,?,?,'AVAILABLE')");try{values.forEach(value=>insert.run(product.id,warehouseId,value));}catch(error){if(String(error.code).includes("SQLITE_CONSTRAINT"))throw new InventoryError("A serial number already exists",409);throw error;}}
function takeSerials(product,warehouseId,quantity,status,destination=null,requested=[]){
  if(!product.track_serials)return;
  const values=(Array.isArray(requested)?requested:[]).map(value=>String(value).trim()).filter(Boolean);
  let rows;
  if(values.length){
    if(values.length!==quantity||new Set(values.map(value=>value.toLocaleLowerCase())).size!==values.length)
      throw new InventoryError("Select one available serial number for each returned unit",409);
    const select=db.prepare("SELECT id FROM stock_serials WHERE product_id=? AND warehouse_id=? AND serial_number=? COLLATE NOCASE AND status='AVAILABLE'");
    rows=values.map(value=>select.get(product.id,warehouseId,value)).filter(Boolean);
  }else rows=db.prepare("SELECT id FROM stock_serials WHERE product_id=? AND warehouse_id=? AND status='AVAILABLE' ORDER BY received_at,id LIMIT ?").all(product.id,warehouseId,quantity);
  if(rows.length!==quantity)throw new InventoryError("Not enough available serial numbers",409);
  const update=destination?db.prepare("UPDATE stock_serials SET warehouse_id=?,status='AVAILABLE',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='AVAILABLE'"):db.prepare("UPDATE stock_serials SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='AVAILABLE'");
  rows.forEach(row=>{const result=destination?update.run(destination,row.id):update.run(status,row.id);if(result.changes!==1)throw new InventoryError("Serial allocation conflict",409)});
}
const receiveStock = db.transaction((data, user) => {
  const target = warehouse(data.warehouse_id, user),
    { product, unit } = selection(data.product_id, data.product_unit_id),
    quantity = baseQuantity(data.quantity, unit.conversion_factor);
  const batchId = product.track_batches
    ? receiveBatch(product, target.id, data, quantity, unit.conversion_factor)
    : null;
  insertSerials(product,target.id,serialInput(product,data,quantity));
  changeBalance(product.id, target.id, quantity);
  movement({
    productId: product.id,
    warehouseId: target.id,
    batchId,
    type: "RECEIPT",
    quantity,
    note: String(data.note || "").trim() || null,
    userId: user.id,
  });
  return {
    quantity,
    base_unit_name: unit.base_unit_name,
    base_unit_symbol: unit.base_unit_symbol,
  };
});
const adjustStock = db.transaction((data, user) => {
  const target = warehouse(data.warehouse_id, user),
    { product, unit } = selection(data.product_id, data.product_unit_id),
    absolute = baseQuantity(data.quantity, unit.conversion_factor),
    incoming = data.direction === "in";
  if (!incoming && data.direction !== "out")
    throw new InventoryError("Adjustment direction is invalid");
  const quantity = incoming ? absolute : -absolute;
  if(product.track_serials){if(incoming)insertSerials(product,target.id,serialInput(product,data,absolute));else takeSerials(product,target.id,absolute,data.serial_out_status||"DAMAGED",null,data.serial_numbers);}
  let batchId = null;
  if (product.track_batches) {
    if (incoming)
      batchId = receiveBatch(
        product,
        target.id,
        data,
        absolute,
        unit.conversion_factor,
      );
    else {
      batchId = Number(data.batch_id);
      const batch = db
        .prepare(
          "SELECT id,quantity FROM stock_batches WHERE id=? AND product_id=? AND warehouse_id=?",
        )
        .get(batchId, product.id, target.id);
      if (!batch || batch.quantity < absolute)
        throw new InventoryError("Insufficient batch quantity", 409);
      db.prepare("UPDATE stock_batches SET quantity=quantity-? WHERE id=?").run(
        absolute,
        batchId,
      );
    }
  }
  changeBalance(product.id, target.id, quantity);
  movement({
    productId: product.id,
    warehouseId: target.id,
    batchId,
    type: incoming ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
    quantity,
    note: String(data.note || "").trim() || null,
    userId: user.id,
  });
  return { quantity };
});
const transferStock = db.transaction((data, user) => {
  const source = warehouse(data.source_warehouse_id, user),
    destination = warehouse(data.destination_warehouse_id, user);
  if (source.id === destination.id)
    throw new InventoryError("Source and destination must be different");
  const { product, unit } = selection(data.product_id, data.product_unit_id),
    quantity = baseQuantity(data.quantity, unit.conversion_factor),
    referenceId = crypto.randomUUID();
  let sourceBatchId = null,
    destinationBatchId = null;
  if (product.track_batches) {
    sourceBatchId = Number(data.batch_id);
    const batch = db
      .prepare(
        "SELECT * FROM stock_batches WHERE id=? AND product_id=? AND warehouse_id=?",
      )
      .get(sourceBatchId, product.id, source.id);
    if (!batch || batch.quantity < quantity)
      throw new InventoryError("Insufficient batch quantity", 409);
    db.prepare("UPDATE stock_batches SET quantity=quantity-? WHERE id=?").run(
      quantity,
      sourceBatchId,
    );
    const destinationBatch = db
      .prepare(
        "SELECT id FROM stock_batches WHERE product_id=? AND warehouse_id=? AND batch_number=? AND expiration_date IS ?",
      )
      .get(
        product.id,
        destination.id,
        batch.batch_number,
        batch.expiration_date,
      );
    if (destinationBatch) {
      destinationBatchId = Number(destinationBatch.id);
      db.prepare("UPDATE stock_batches SET quantity=quantity+? WHERE id=?").run(
        quantity,
        destinationBatchId,
      );
    } else
      destinationBatchId = Number(
        db
          .prepare(
            "INSERT INTO stock_batches(product_id,warehouse_id,batch_number,expiration_date,quantity,purchase_price) VALUES(?,?,?,?,?,?)",
          )
          .run(
            product.id,
            destination.id,
            batch.batch_number,
            batch.expiration_date,
            quantity,
            batch.purchase_price,
          ).lastInsertRowid,
      );
  }
  if(product.track_serials)takeSerials(product,source.id,quantity,"TRANSFERRED",destination.id);
  changeBalance(product.id, source.id, -quantity);
  changeBalance(product.id, destination.id, quantity);
  const common = {
    productId: product.id,
    referenceType: "TRANSFER",
    referenceId,
    note: String(data.note || "").trim() || null,
    userId: user.id,
  };
  movement({
    ...common,
    warehouseId: source.id,
    batchId: sourceBatchId,
    type: "TRANSFER_OUT",
    quantity: -quantity,
  });
  movement({
    ...common,
    warehouseId: destination.id,
    batchId: destinationBatchId,
    type: "TRANSFER_IN",
    quantity,
  });
  return { quantity, reference_id: referenceId };
});

function listStock(filters, user) {
  const expirationSettings = Settings.getGroup("expiration"),
    target = warehouse(filters.warehouseId, user),
    params = {
      warehouse_id: target.id,
      warning_modifier: `+${expirationSettings.warning_days} days`,
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    },
    conditions = [];
  if (filters.search) {
    conditions.push(
      "(p.designation LIKE @search COLLATE NOCASE OR p.reference LIKE @search COLLATE NOCASE OR EXISTS(SELECT 1 FROM product_barcodes pb WHERE pb.product_id=p.id AND pb.barcode LIKE @search))",
    );
    params.search = `%${filters.search}%`;
  }
  const quantity = "COALESCE(ps.quantity,0)";
  if (filters.status === "low")
    conditions.push(
      `p.track_stock=1 AND ${quantity}>0 AND ${quantity}<=p.min_stock`,
    );
  if (filters.status === "out")
    conditions.push(`p.track_stock=1 AND ${quantity}<=0`);
  if (filters.status === "attention")
    conditions.push(`p.track_stock=1 AND p.min_stock>0 AND ${quantity}<=p.min_stock`);
  if (filters.status === "expired")
    conditions.push(
      "p.track_stock=1 AND EXISTS(SELECT 1 FROM stock_batches sb WHERE sb.product_id=p.id AND sb.warehouse_id=@warehouse_id AND sb.quantity>0 AND sb.expiration_date<date('now'))",
    );
  if (filters.status === "expiring")
    conditions.push(
      "p.track_stock=1 AND EXISTS(SELECT 1 FROM stock_batches sb WHERE sb.product_id=p.id AND sb.warehouse_id=@warehouse_id AND sb.quantity>0 AND sb.expiration_date BETWEEN date('now') AND date('now', @warning_modifier))",
    );
  const where = `WHERE p.is_active=1${conditions.length ? ` AND ${conditions.join(" AND ")}` : ""}`;
  const rows = db
    .prepare(
      `SELECT p.id,p.designation,p.reference,p.min_stock,p.track_stock,p.track_batches,p.track_expiration,c.name category_name,${quantity} quantity,u.name unit_name,u.symbol unit_symbol,u.is_builtin unit_is_builtin,(SELECT COUNT(*) FROM stock_batches sb WHERE sb.product_id=p.id AND sb.warehouse_id=@warehouse_id AND sb.quantity>0) batch_count FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=@warehouse_id JOIN product_units base ON base.product_id=p.id AND base.is_base=1 JOIN units u ON u.id=base.unit_id ${where} ORDER BY p.designation COLLATE NOCASE LIMIT @limit OFFSET @offset`,
    )
    .all(params);
  const countParams = { ...params };
  delete countParams.limit;
  delete countParams.offset;
  const total = db
    .prepare(
      `SELECT COUNT(*) count FROM products p LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=@warehouse_id ${where}`,
    )
    .get(countParams).count;
  return {
    warehouse: target,
    items: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}
function listProducts(search, user, warehouseId) {
  warehouse(warehouseId, user);
  const value = `%${String(search || "").trim()}%`;
  const products = db
    .prepare(
      `SELECT p.id,p.designation,p.reference,p.track_batches,p.track_expiration,p.track_serials,COALESCE(ps.quantity,0) stock_quantity FROM products p LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.warehouse_id=? WHERE p.is_active=1 AND p.track_stock=1 AND (p.designation LIKE ? COLLATE NOCASE OR p.reference LIKE ? COLLATE NOCASE OR EXISTS(SELECT 1 FROM product_barcodes b WHERE b.product_id=p.id AND b.barcode LIKE ?)) ORDER BY p.designation COLLATE NOCASE LIMIT 50`,
    )
    .all(warehouseId, value, value, value);
  const units = db
    .prepare(
      `SELECT pu.id,pu.product_id,pu.conversion_factor,pu.purchase_price,pu.is_base,u.name unit_name,u.symbol unit_symbol,base_u.name base_unit_name,base_u.symbol base_unit_symbol FROM product_units pu JOIN units u ON u.id=pu.unit_id JOIN product_units base ON base.product_id=pu.product_id AND base.is_base=1 JOIN units base_u ON base_u.id=base.unit_id WHERE pu.is_active=1 AND pu.product_id IN (${products.map(() => "?").join(",") || "NULL"}) ORDER BY pu.is_base DESC,pu.id`,
    )
    .all(...products.map((item) => item.id));
  products.forEach(
    (product) =>
      (product.product_units = units.filter(
        (unit) => unit.product_id === product.id,
      )),
  );
  return products;
}
function listBatches(productId, warehouseId, user) {
  warehouse(warehouseId, user);
  return db
    .prepare(
      "SELECT id,batch_number,expiration_date,quantity,purchase_price,received_at FROM stock_batches WHERE product_id=? AND warehouse_id=? AND quantity>0 ORDER BY CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,expiration_date,batch_number",
    )
    .all(Number(productId), Number(warehouseId));
}
function listMovements(filters, user) {
  warehouse(filters.warehouseId, user);
  const params = {
      warehouse_id: filters.warehouseId,
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    },
    conditions = ["sm.warehouse_id=@warehouse_id"];
  if (filters.productId) {
    conditions.push("sm.product_id=@product_id");
    params.product_id = filters.productId;
  }
  if (filters.type) {
    conditions.push("sm.type=@type");
    params.type = filters.type;
  }
  if (filters.from) {
    conditions.push("date(sm.created_at)>=@from");
    params.from = filters.from;
  }
  if (filters.to) {
    conditions.push("date(sm.created_at)<=@to");
    params.to = filters.to;
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const rows = db
    .prepare(
      `SELECT sm.*,p.designation,w.name warehouse_name,u.name unit_name,u.symbol unit_symbol,usr.name user_name,sb.batch_number FROM stock_movements sm JOIN products p ON p.id=sm.product_id JOIN warehouses w ON w.id=sm.warehouse_id JOIN users usr ON usr.id=sm.created_by LEFT JOIN stock_batches sb ON sb.id=sm.batch_id JOIN product_units base ON base.product_id=p.id AND base.is_base=1 JOIN units u ON u.id=base.unit_id ${where} ORDER BY sm.created_at DESC,sm.id DESC LIMIT @limit OFFSET @offset`,
    )
    .all(params);
  const countParams = { ...params };
  delete countParams.limit;
  delete countParams.offset;
  const total = db
    .prepare(`SELECT COUNT(*) count FROM stock_movements sm ${where}`)
    .get(countParams).count;
  return {
    movements: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}
module.exports = {
  InventoryError,
  receiveStock,
  adjustStock,
  transferStock,
  listStock,
  listProducts,
  listBatches,
  listMovements,
};
