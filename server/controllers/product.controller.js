const Product = require("../models/product.model"),
  Category = require("../models/category.model"),
  Unit = require("../models/unit.model");
const nonnegative = (value, label) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? { value: number }
    : { error: `${label} must be zero or greater` };
};
const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
function validateProduct(body, user, existing = null) {
  const designation =
      typeof body.designation === "string" ? body.designation.trim() : "",
    reference =
      typeof body.reference === "string" && body.reference.trim()
        ? body.reference.trim()
        : null,
    categoryId = Number(body.category_id);
  if (!designation) return { error: "Product designation is required" };
  if (!Number.isInteger(categoryId)) return { error: "Category is required" };
  const category = Category.findById(categoryId);
  if (
    !category ||
    (!category.is_active && existing?.category_id !== categoryId)
  )
    return { error: "Category must exist and be active" };
  if (Product.referenceExists(reference, existing?.id))
    return { error: "Product reference already exists", status: 409 };
  const tax = nonnegative(body.tax_rate ?? 0, "Tax rate"),
    minimum = nonnegative(body.min_stock ?? 0, "Minimum stock");
  if (tax.error) return tax;
  if (minimum.error) return minimum;
  for (const field of [
    "track_stock",
    "track_batches",
    "track_expiration",
    "track_serials",
  ])
    if (body[field] !== undefined && typeof body[field] !== "boolean")
      return { error: `${field} must be a boolean` };
  const trackExpiration =
      body.track_expiration === true || body.has_expiration === true,
    trackBatches = body.track_batches === true || trackExpiration,
    trackSerials = body.track_serials === true,
    trackStock = body.track_stock !== false || trackBatches || trackSerials;
  if (!trackStock && (trackBatches || trackExpiration || trackSerials))
    return {
      error: "Batch, expiration and serial tracking require stock tracking",
    };
  if (trackExpiration && !trackBatches)
    return { error: "Expiration tracking requires batch tracking" };
  if (
    existing &&
    existing.track_stock &&
    !trackStock &&
    Product.hasStockRows(existing.id)
  )
    return {
      error: "Stock tracking cannot be disabled while stock records exist",
    };
  if (
    existing &&
    existing.track_batches &&
    !trackBatches &&
    Product.hasBatchRows(existing.id)
  )
    return {
      error: "Batch tracking cannot be disabled while batch records exist",
    };
  const rawUnits =
    Array.isArray(body.product_units) && body.product_units.length
      ? body.product_units
      : [
          {
            unit_id: body.unit_id,
            conversion_factor: 1,
            purchase_price: body.purchase_price,
            selling_price: body.selling_price,
            is_base: true,
            is_active: true,
            barcodes: body.barcodes || [],
          },
        ];
  if (!rawUnits.length)
    return { error: "At least one product unit is required" };
  const productUnits = [],
    allBarcodes = [];
  for (const raw of rawUnits) {
    const prior = existing?.product_units?.find(
      (item) => item.id === Number(raw.id),
    );
    const suppliedUnitId = Number(raw.unit_id);
    const genericUnit = raw.is_base === true && !Number.isInteger(suppliedUnitId || NaN)
      ? Unit.findGeneric()
      : null;
    const unitId = genericUnit?.id || suppliedUnitId,
      factor = nonnegative(raw.conversion_factor ?? 1, "Conversion factor"),
      purchase = nonnegative(raw.purchase_price ?? 0, "Purchase price"),
      selling = nonnegative(raw.selling_price ?? 0, "Selling price");
    if (
      !Number.isInteger(unitId) ||
      factor.error ||
      factor.value <= 0 ||
      purchase.error ||
      selling.error
    )
      return {
        error:
          "Each package requires a valid unit, conversion factor and prices",
      };
    const unit = Unit.findById(unitId);
    if (!unit || (!unit.is_active && !prior))
      return { error: "Product units must exist and be active" };
    const barcodes = (Array.isArray(raw.barcodes) ? raw.barcodes : [])
      .map((item) => ({
        barcode: String(item?.barcode || item || "").trim(),
        is_primary: item?.is_primary === true,
      }))
      .filter((item) => item.barcode);
    if (barcodes.filter((item) => item.is_primary).length > 1)
      return { error: "Only one primary barcode is allowed per package" };
    allBarcodes.push(...barcodes);
    productUnits.push({
      id: prior?.id,
      unit_id: unitId,
      conversion_factor: factor.value,
      purchase_price: purchase.value,
      selling_price: selling.value,
      is_base: raw.is_base === true,
      is_active: raw.is_active !== false,
      barcodes,
    });
  }
  if (
    productUnits.filter((unit) => unit.is_base).length !== 1 ||
    productUnits.find((unit) => unit.is_base).conversion_factor !== 1
  )
    return {
      error: "Exactly one base unit with conversion factor 1 is required",
    };
  if (
    new Set(productUnits.map((unit) => unit.unit_id)).size !==
    productUnits.length
  )
    return { error: "A unit can only be used once per product" };
  if (
    new Set(allBarcodes.map((item) => item.barcode)).size !== allBarcodes.length
  )
    return { error: "Duplicate barcodes are not allowed" };
  for (const item of allBarcodes)
    if (Product.barcodeExists(item.barcode, existing?.id))
      return { error: `Barcode ${item.barcode} already exists`, status: 409 };
  const oldBase = existing?.product_units?.find((unit) => unit.is_base);
  const newBase = productUnits.find((unit) => unit.is_base);
  if (
    existing &&
    Product.hasStockRows(existing.id) &&
    oldBase &&
    oldBase.unit_id !== newBase.unit_id
  )
    return { error: "Base unit cannot change while stock records exist" };
  const initialStock = [];
  if (!existing && trackStock && Array.isArray(body.initial_stock)) {
    const allowed = new Set(
        Product.findActiveWarehouses(user).map((item) => Number(item.id)),
      ),
      seen = new Set();
    for (const row of body.initial_stock) {
      const warehouse = Number(row.warehouse_id),
        quantity = nonnegative(row.quantity, "Initial stock quantity"),
        unitIndex = Number(row.product_unit_index ?? 0);
      if (!Number.isInteger(warehouse) || !allowed.has(warehouse))
        return {
          error: "Initial stock warehouse is inactive or unauthorized",
          status: 403,
        };
      if (
        quantity.error ||
        !Number.isInteger(unitIndex) ||
        !productUnits[unitIndex]
      )
        return { error: quantity.error || "Initial stock package is invalid" };
      if (!trackBatches && seen.has(warehouse))
        return { error: "A warehouse can only appear once in initial stock" };
      seen.add(warehouse);
      const item = {
        warehouse_id: warehouse,
        quantity: quantity.value,
        product_unit_index: unitIndex,
      };
      if (trackBatches) {
        item.batch_number = String(row.batch_number || "").trim();
        item.expiration_date = String(row.expiration_date || "");
        if (trackExpiration && !validDate(item.expiration_date))
          return {
            error: "A valid expiration date is required for each initial batch",
          };
        if (!trackExpiration) item.expiration_date = null;
        const price =
          row.purchase_price === "" || row.purchase_price == null
            ? null
            : nonnegative(row.purchase_price, "Batch purchase price");
        if (price?.error) return price;
        item.purchase_price = price === null ? null : price.value;
      }
      initialStock.push(item);
    }
  }
  return {
    value: {
      designation,
      reference,
      category_id: categoryId,
      tax_rate: tax.value,
      min_stock: minimum.value,
      track_stock: trackStock,
      track_batches: trackBatches,
      track_expiration: trackExpiration,
      track_serials: trackSerials,
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      is_active: body.is_active !== false,
      product_units: productUnits,
      initial_stock: initialStock,
      created_by: Number(user.id),
    },
  };
}
function list(req, res) {
  try {
    const has =
        req.query.warehouse_id !== undefined && req.query.warehouse_id !== "",
      requested = has ? Number(req.query.warehouse_id) : null;
    if (has && (!Number.isInteger(requested) || requested < 1))
      return res.status(400).json({ message: "A valid warehouse is required" });
    const allowed = new Set(
      Product.findActiveWarehouses(req.user).map((item) => Number(item.id)),
    );
    if (requested && !allowed.has(requested))
      return res
        .status(403)
        .json({ message: "Warehouse is inactive or unauthorized" });
    const assigned = Number(req.user.warehouse_id),
      warehouseId =
        req.user.role === "admin"
          ? requested
          : allowed.has(assigned)
            ? assigned
            : -1,
      limit = [25, 50, 100].includes(Number(req.query.limit))
        ? Number(req.query.limit)
        : 25;
    return res.json(
      Product.findPage({
        page: Math.max(1, Number(req.query.page) || 1),
        limit,
        search: String(req.query.search || "").trim(),
        categoryId: Number(req.query.category_id) || null,
        status: ["active", "inactive", "all"].includes(req.query.status)
          ? req.query.status
          : "active",
        stockStatus: ["all", "in_stock", "low_stock", "out_of_stock"].includes(
          req.query.stock_status,
        )
          ? req.query.stock_status
          : "all",
        tracking: ["all", "stock", "batch", "expiration", "serial"].includes(
          req.query.tracking,
        )
          ? req.query.tracking
          : "all",
        warehouseId,
        sort: req.query.sort,
        direction: req.query.direction,
      }),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load products" });
  }
}
function getById(req, res) {
  try {
    const product = Product.findById(req.params.id);
    return product
      ? res.json({ product })
      : res.status(404).json({ message: "Product not found" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load product" });
  }
}
function save(req, res, existing) {
  const result = validateProduct(req.body, req.user, existing);
  if (result.error)
    return res.status(result.status || 400).json({ message: result.error });
  try {
    const product = existing
      ? Product.update(existing.id, result.value)
      : Product.create(result.value);
    return res.status(existing ? 200 : 201).json({ product });
  } catch (error) {
    console.error(error);
    return res
      .status(error.code?.startsWith("SQLITE_CONSTRAINT") ? 409 : 500)
      .json({
        message: error.code?.startsWith("SQLITE_CONSTRAINT")
          ? "Product reference, unit or barcode already exists"
          : "Failed to save product",
      });
  }
}
module.exports = {
  list,
  getById,
  create: (req, res) => save(req, res, null),
  update(req, res) {
    const product = Product.findById(req.params.id);
    return product
      ? save(req, res, product)
      : res.status(404).json({ message: "Product not found" });
  },
  setStatus(req, res) {
    try {
      const product = Product.setActive(
        req.params.id,
        req.body.is_active === true,
      );
      return product
        ? res.json({ product })
        : res.status(404).json({ message: "Product not found" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Failed to update product status" });
    }
  },
  warehouses(req, res) {
    try {
      return res.json({ warehouses: Product.findActiveWarehouses(req.user) });
    } catch (error) {
      return res.status(500).json({ message: "Failed to load warehouses" });
    }
  },
};
