const db = require("../config/database");

const stockSql = (warehouseId) =>
  warehouseId
    ? "COALESCE((SELECT SUM(quantity) FROM product_stock ps WHERE ps.product_id=p.id AND ps.warehouse_id=@warehouse_id),0)"
    : "COALESCE((SELECT SUM(quantity) FROM product_stock ps WHERE ps.product_id=p.id),0)";
function findPage(filters) {
  const params = {
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
  };
  if (filters.warehouseId) params.warehouse_id = filters.warehouseId;
  const stock = stockSql(filters.warehouseId),
    conditions = [];
  if (filters.search) {
    conditions.push(
      "(p.designation LIKE @search COLLATE NOCASE OR p.reference LIKE @search COLLATE NOCASE OR EXISTS(SELECT 1 FROM product_barcodes b WHERE b.product_id=p.id AND b.barcode LIKE @search))",
    );
    params.search = `%${filters.search}%`;
  }
  if (filters.categoryId) {
    conditions.push("p.category_id=@category_id");
    params.category_id = filters.categoryId;
  }
  if (filters.status === "active") conditions.push("p.is_active=1");
  if (filters.status === "inactive") conditions.push("p.is_active=0");
  const tracking = {
    stock: "track_stock",
    batch: "track_batches",
    expiration: "track_expiration",
    serial: "track_serials",
  }[filters.tracking];
  if (tracking) conditions.push(`p.${tracking}=1`);
  if (filters.stockStatus === "in_stock")
    conditions.push(`p.track_stock=1 AND ${stock}>p.min_stock`);
  if (filters.stockStatus === "low_stock")
    conditions.push(`p.track_stock=1 AND ${stock}>0 AND ${stock}<=p.min_stock`);
  if (filters.stockStatus === "out_of_stock")
    conditions.push(`p.track_stock=1 AND ${stock}<=0`);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    sort =
      {
        designation: "p.designation COLLATE NOCASE",
        reference: "p.reference COLLATE NOCASE",
        selling_price: "base.selling_price",
        stock: "stock_quantity",
        created_at: "p.created_at",
      }[filters.sort] || "p.designation COLLATE NOCASE",
    direction = filters.direction === "desc" ? "DESC" : "ASC";
  const products = db
    .prepare(
      `SELECT p.id,p.designation,p.reference,p.category_id,p.tax_rate,p.min_stock,p.track_stock,p.track_batches,p.track_expiration,p.track_serials,p.is_active,p.created_at,c.name category_name,base.unit_id,base.purchase_price,base.selling_price,u.name unit_name,u.symbol unit_symbol,u.is_builtin unit_is_builtin,(SELECT barcode FROM product_barcodes b WHERE b.product_id=p.id ORDER BY is_primary DESC,id LIMIT 1) primary_barcode,(SELECT COUNT(*) FROM product_barcodes b WHERE b.product_id=p.id) barcode_count,(SELECT COUNT(*) FROM product_units pu WHERE pu.product_id=p.id AND pu.is_active=1) package_count,${stock} stock_quantity FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN product_units base ON base.product_id=p.id AND base.is_base=1 LEFT JOIN units u ON u.id=base.unit_id ${where} ORDER BY ${sort} ${direction},p.id LIMIT @limit OFFSET @offset`,
    )
    .all(params);
  const countParams = { ...params };
  delete countParams.limit;
  delete countParams.offset;
  if (!filters.stockStatus || filters.stockStatus === "all")
    delete countParams.warehouse_id;
  const total = db
    .prepare(`SELECT COUNT(*) count FROM products p ${where}`)
    .get(countParams).count;
  return {
    products,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}
function findById(id) {
  const product = db
    .prepare(
      "SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?",
    )
    .get(id);
  if (!product) return null;
  product.product_units = db
    .prepare(
      "SELECT pu.*,u.name unit_name,u.symbol unit_symbol,u.is_builtin unit_is_builtin FROM product_units pu JOIN units u ON u.id=pu.unit_id WHERE pu.product_id=? AND pu.is_active=1 ORDER BY pu.is_base DESC,pu.id",
    )
    .all(id);
  const barcodes = db
    .prepare(
      "SELECT id,product_unit_id,barcode,is_primary FROM product_barcodes WHERE product_id=? ORDER BY is_primary DESC,id",
    )
    .all(id);
  product.product_units.forEach(
    (unit) =>
      (unit.barcodes = barcodes.filter(
        (code) => code.product_unit_id === unit.id,
      )),
  );
  product.barcodes = barcodes;
  const base = product.product_units.find((unit) => unit.is_base);
  if (base)
    Object.assign(product, {
      unit_id: base.unit_id,
      purchase_price: base.purchase_price,
      selling_price: base.selling_price,
      unit_name: base.unit_name,
      unit_symbol: base.unit_symbol,
    });
  return product;
}
function referenceExists(value, id) {
  if (!value) return false;
  return !!db
    .prepare(
      id
        ? "SELECT 1 FROM products WHERE reference=? COLLATE NOCASE AND id!=?"
        : "SELECT 1 FROM products WHERE reference=? COLLATE NOCASE",
    )
    .get(...(id ? [value, id] : [value]));
}
function barcodeExists(value, id) {
  return !!db
    .prepare(
      id
        ? "SELECT 1 FROM product_barcodes WHERE barcode=? AND product_id!=?"
        : "SELECT 1 FROM product_barcodes WHERE barcode=?",
    )
    .get(...(id ? [value, id] : [value]));
}
function hasStockRows(id) {
  return !!db
    .prepare("SELECT 1 FROM product_stock WHERE product_id=? LIMIT 1")
    .get(id);
}
function hasBatchRows(id) {
  return !!db
    .prepare("SELECT 1 FROM stock_batches WHERE product_id=? LIMIT 1")
    .get(id);
}
function saveUnits(productId, units, updating) {
  if (updating)
    db.prepare(
      "UPDATE product_units SET is_active=0,is_base=0 WHERE product_id=?",
    ).run(productId);
  const insert = db.prepare(
      "INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base,is_active) VALUES(?,?,?,?,?,?,?)",
    ),
    update = db.prepare(
      "UPDATE product_units SET unit_id=?,conversion_factor=?,purchase_price=?,selling_price=?,is_base=?,is_active=? WHERE id=? AND product_id=?",
    ),
    ids = [];
  units.forEach((unit) => {
    let id = Number(unit.id);
    if (id && updating)
      update.run(
        unit.unit_id,
        unit.conversion_factor,
        unit.purchase_price,
        unit.selling_price,
        +unit.is_base,
        +unit.is_active,
        id,
        productId,
      );
    else
      id = Number(
        insert.run(
          productId,
          unit.unit_id,
          unit.conversion_factor,
          unit.purchase_price,
          unit.selling_price,
          +unit.is_base,
          +unit.is_active,
        ).lastInsertRowid,
      );
    ids.push(id);
  });
  db.prepare("DELETE FROM product_barcodes WHERE product_id=?").run(productId);
  const add = db.prepare(
    "INSERT INTO product_barcodes(product_id,product_unit_id,barcode,is_primary) VALUES(?,?,?,?)",
  );
  units.forEach((unit, index) =>
    unit.barcodes.forEach((code) =>
      add.run(productId, ids[index], code.barcode, +code.is_primary),
    ),
  );
  return ids;
}
function insertInitialStock(productId, data) {
  if (!data.track_stock) return;
  const totals = new Map(),
    batch = db.prepare(
      "INSERT INTO stock_batches(product_id,warehouse_id,batch_number,expiration_date,quantity,purchase_price) VALUES(?,?,?,?,?,?)",
    );
  const movement=db.prepare("INSERT INTO stock_movements(product_id,warehouse_id,batch_id,type,quantity,reference_type,reference_id,note,created_by) VALUES(?,?,?,'INITIAL_STOCK',?,'PRODUCT',?,NULL,?)");
  data.initial_stock.forEach((row) => {
    const unit = data.product_units[row.product_unit_index],
      quantity = row.quantity * unit.conversion_factor;
    totals.set(
      row.warehouse_id,
      (totals.get(row.warehouse_id) || 0) + quantity,
    );
    let batchId=null;
    if (data.track_batches)
      batchId=Number(batch.run(
        productId,
        row.warehouse_id,
        row.batch_number || null,
        row.expiration_date || null,
        quantity,
        row.purchase_price == null
          ? null
          : row.purchase_price / unit.conversion_factor,
      ).lastInsertRowid);
    movement.run(productId,row.warehouse_id,batchId,quantity,String(productId),data.created_by);
  });
  const add = db.prepare(
    "INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,?)",
  );
  totals.forEach((quantity, warehouse) =>
    add.run(productId, warehouse, quantity),
  );
}
const create = db.transaction((data) => {
  const base = data.product_units.find((unit) => unit.is_base),
    result = db
      .prepare(
        "INSERT INTO products(designation,reference,category_id,unit_id,purchase_price,selling_price,tax_rate,min_stock,track_stock,track_batches,track_expiration,track_serials,has_expiration,description,is_active) VALUES(@designation,@reference,@category_id,@unit_id,@purchase_price,@selling_price,@tax_rate,@min_stock,@track_stock,@track_batches,@track_expiration,@track_serials,@has_expiration,@description,@is_active)",
      )
      .run({
        ...data,
        unit_id: base.unit_id,
        purchase_price: base.purchase_price,
        selling_price: base.selling_price,
        track_stock: +data.track_stock,
        track_batches: +data.track_batches,
        track_expiration: +data.track_expiration,
        track_serials: +data.track_serials,
        has_expiration: +data.track_expiration,
        is_active: +data.is_active,
      });
  const id = Number(result.lastInsertRowid);
  saveUnits(id, data.product_units, false);
  insertInitialStock(id, data);
  return findById(id);
});
const update = db.transaction((id, data) => {
  const base = data.product_units.find((unit) => unit.is_base);
  db.prepare(
    "UPDATE products SET designation=@designation,reference=@reference,category_id=@category_id,unit_id=@unit_id,purchase_price=@purchase_price,selling_price=@selling_price,tax_rate=@tax_rate,min_stock=@min_stock,track_stock=@track_stock,track_batches=@track_batches,track_expiration=@track_expiration,track_serials=@track_serials,has_expiration=@has_expiration,description=@description,is_active=@is_active,updated_at=CURRENT_TIMESTAMP WHERE id=@id",
  ).run({
    id,
    ...data,
    unit_id: base.unit_id,
    purchase_price: base.purchase_price,
    selling_price: base.selling_price,
    track_stock: +data.track_stock,
    track_batches: +data.track_batches,
    track_expiration: +data.track_expiration,
    track_serials: +data.track_serials,
    has_expiration: +data.track_expiration,
    is_active: +data.is_active,
  });
  saveUnits(id, data.product_units, true);
  return findById(id);
});
function findActiveWarehouses(user) {
  if (user.role === "admin")
    return db
      .prepare(
        "SELECT id,name FROM warehouses WHERE is_active=1 ORDER BY name COLLATE NOCASE",
      )
      .all();
  return user.warehouse_id
    ? db
        .prepare("SELECT id,name FROM warehouses WHERE id=? AND is_active=1")
        .all(user.warehouse_id)
    : [];
}
module.exports = {
  findPage,
  findById,
  referenceExists,
  barcodeExists,
  hasStockRows,
  hasBatchRows,
  create,
  update,
  setActive(id, active) {
    const result = db
      .prepare(
        "UPDATE products SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(+active, id);
    return result.changes ? findById(id) : null;
  },
  findActiveWarehouses,
};
