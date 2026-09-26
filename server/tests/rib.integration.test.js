const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Warehouse = require("../models/warehouse.model");
const Customer = require("../models/customer.model");
const Supplier = require("../models/supplier.model");
const { validatePartner } = require("../utils/partner");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouse = Warehouse.create({
      name: `RIB warehouse ${stamp}`,
      rib: `WH-RIB-${stamp}`,
      can_sell: true,
      is_active: true,
    });
    assert.equal(warehouse.rib, `WH-RIB-${stamp}`);

    const customerData = validatePartner(
      { name: `RIB customer ${stamp}`, rib: `CU-RIB-${stamp}` },
      "Customer",
    ).value;
    const customer = Customer.create(customerData);
    assert.equal(customer.rib, `CU-RIB-${stamp}`);

    const supplierData = validatePartner(
      { name: `RIB supplier ${stamp}`, rib: `SU-RIB-${stamp}` },
      "Supplier",
    ).value;
    const supplier = Supplier.create(supplierData);
    assert.equal(supplier.rib, `SU-RIB-${stamp}`);

    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("RIB integration test passed for warehouses, customers and suppliers.");
