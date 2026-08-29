const assert = require("node:assert/strict");
const db = require("../config/database");
const Product = require("../models/product.model");
const ProductController = require("../controllers/product.controller");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function createThroughController(body, user) {
  const res = response();
  ProductController.create({ body, user }, res);
  return res;
}

let completed = false;
try {
  db.transaction(() => {
    const warehouseA = db.prepare("INSERT INTO warehouses(name) VALUES (?)").run("Product Test A").lastInsertRowid;
    const warehouseB = db.prepare("INSERT INTO warehouses(name) VALUES (?)").run("Product Test B").lastInsertRowid;
    const categoryId = db.prepare("INSERT INTO categories(name) VALUES (?)").run("Product Test Category").lastInsertRowid;
    const unitId = db.prepare("INSERT INTO units(name, symbol) VALUES (?, ?)").run("Product Test Unit", "ptu").lastInsertRowid;
    const caseUnitId = db.prepare("INSERT INTO units(name, symbol) VALUES (?, ?)").run("Product Test Case", "case").lastInsertRowid;
    const admin = { id: 1, role: "admin", warehouse_id: null };
    const normalUser = { id: 1, role: "cashier", warehouse_id: warehouseA };
    const genericUnit = db.prepare("SELECT * FROM units WHERE is_builtin = 1").get();
    assert.equal(genericUnit.name, "Unit\u00e9");
    assert.equal(genericUnit.symbol, "");
    assert.equal(db.prepare("SELECT COUNT(*) count FROM units WHERE is_builtin = 1").get().count, 1);

    const simple = createThroughController({
      designation: "Integration Printer", reference: "INT-PRINTER", category_id: categoryId,
      track_stock: true, product_units: [{ unit_id: null, conversion_factor: 1, purchase_price: 25000, selling_price: 30000, is_base: true, is_active: true, barcodes: [] }],
      initial_stock: [{ warehouse_id: warehouseA, product_unit_index: 0, quantity: 1 }],
    }, admin);
    assert.equal(simple.statusCode, 201);
    assert.equal(simple.body.product.product_units[0].unit_id, genericUnit.id);
    assert.equal(simple.body.product.product_units[0].conversion_factor, 1);
    assert.equal(db.prepare("SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?").get(simple.body.product.id, warehouseA).quantity, 1);

    const standard = createThroughController({
      designation: "Integration Cola", reference: "INT-COLA", category_id: categoryId, unit_id: unitId,
      purchase_price: 90, selling_price: 120, tax_rate: 19, min_stock: 10,
      track_stock: true, has_expiration: false,
      barcodes: [{ barcode: "990000000001", is_primary: true }, { barcode: "990000000002" }],
      initial_stock: [{ warehouse_id: warehouseA, quantity: 50 }, { warehouse_id: warehouseB, quantity: 25 }],
    }, admin);
    assert.equal(standard.statusCode, 201);

    const packaged = createThroughController({
      designation: "Integration Packaged", reference: "INT-PACK", category_id: categoryId, tax_rate: 0, min_stock: 0,
      track_stock: true, track_batches: false, track_expiration: false, track_serials: false,
      product_units: [
        { unit_id: unitId, conversion_factor: 1, purchase_price: 10, selling_price: 15, is_base: true, is_active: true, barcodes: [{ barcode: "990000000010", is_primary: true }] },
        { unit_id: caseUnitId, conversion_factor: 12, purchase_price: 100, selling_price: 150, is_base: false, is_active: true, barcodes: [{ barcode: "990000000011", is_primary: true }] },
      ],
      initial_stock: [{ warehouse_id: warehouseA, product_unit_index: 1, quantity: 3 }],
    }, admin);
    assert.equal(packaged.statusCode, 201);
    assert.equal(packaged.body.product.product_units.length, 2);
    assert.equal(db.prepare("SELECT quantity FROM product_stock WHERE product_id=? AND warehouse_id=?").get(packaged.body.product.id, warehouseA).quantity, 36);

    const expiring = createThroughController({
      designation: "Integration Milk", reference: "INT-MILK", category_id: categoryId, unit_id: unitId,
      purchase_price: 80, selling_price: 110, tax_rate: 0, min_stock: 5,
      track_stock: true, has_expiration: true, barcodes: [],
      initial_stock: [
        { warehouse_id: warehouseA, quantity: 20, batch_number: "LOT-A", expiration_date: "2027-01-01" },
        { warehouse_id: warehouseA, quantity: 30, batch_number: "LOT-B", expiration_date: "2027-02-01" },
      ],
    }, admin);
    assert.equal(expiring.statusCode, 201);
    assert.equal(db.prepare("SELECT quantity FROM product_stock WHERE product_id = ? AND warehouse_id = ?").get(expiring.body.product.id, warehouseA).quantity, 50);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stock_batches WHERE product_id = ?").get(expiring.body.product.id).count, 2);

    const disableTrackedStock = response();
    ProductController.update({ params: { id: standard.body.product.id }, user: admin, body: {
      ...standard.body.product, category_id: categoryId, unit_id: unitId,
      track_stock: false, has_expiration: false,
    } }, disableTrackedStock);
    assert.equal(disableTrackedStock.statusCode, 400);

    const disableBatchTracking = response();
    ProductController.update({ params: { id: expiring.body.product.id }, user: admin, body: {
      ...expiring.body.product, category_id: categoryId, unit_id: unitId,
      track_stock: true, has_expiration: false,
    } }, disableBatchTracking);
    assert.equal(disableBatchTracking.statusCode, 400);

    const page = Product.findPage({ page: 1, limit: 25, search: "990000000002", categoryId: null, status: "active", stockStatus: "all", warehouseId: null, hasExpiration: "all", sort: "designation", direction: "asc" });
    assert.equal(page.products.length, 1);
    assert.equal(page.products[0].stock_quantity, 75);

    const warehousePage = Product.findPage({ page: 1, limit: 25, search: "", categoryId: null, status: "active", stockStatus: "in_stock", warehouseId: warehouseA, hasExpiration: "all", sort: "stock", direction: "desc" });
    assert.equal(warehousePage.products.find((product) => product.reference === "INT-COLA").stock_quantity, 50);

    const unauthorized = createThroughController({
      designation: "Unauthorized Stock", category_id: categoryId, unit_id: unitId,
      track_stock: true, has_expiration: false, barcodes: [], initial_stock: [{ warehouse_id: warehouseB, quantity: 1 }],
    }, normalUser);
    assert.equal(unauthorized.statusCode, 403);

    const unauthorizedFilter = response();
    ProductController.list({ query: { warehouse_id: warehouseB }, user: normalUser }, unauthorizedFilter);
    assert.equal(unauthorizedFilter.statusCode, 403);

    const unknownAdminWarehouse = response();
    ProductController.list({ query: { warehouse_id: 999999 }, user: admin }, unknownAdminWarehouse);
    assert.equal(unknownAdminWarehouse.statusCode, 403);

    const invalidWarehouse = response();
    ProductController.list({ query: { warehouse_id: "invalid" }, user: admin }, invalidWarehouse);
    assert.equal(invalidWarehouse.statusCode, 400);

    const noWarehouseList = response();
    ProductController.list({ query: {}, user: { id: 1, role: "cashier", warehouse_id: null } }, noWarehouseList);
    assert.equal(noWarehouseList.statusCode, 200);
    assert.equal(noWarehouseList.body.products.every((product) => product.stock_quantity === 0), true);

    const duplicate = createThroughController({
      designation: "Duplicate Barcode", category_id: categoryId, unit_id: unitId,
      track_stock: false, has_expiration: false, barcodes: [{ barcode: "990000000001" }], initial_stock: [],
    }, admin);
    assert.equal(duplicate.statusCode, 409);

    completed = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}

assert.equal(completed, true);
console.log("Product integration test passed (transaction rolled back).");
