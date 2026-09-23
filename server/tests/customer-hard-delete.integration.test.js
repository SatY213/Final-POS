const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Customer = require("../models/customer.model");

let complete = false;
try {
  db.transaction(() => {
    const removableId = Number(
      db.prepare("INSERT INTO customers(name,is_active) VALUES(?,1)").run("Removable customer").lastInsertRowid,
    );
    db.prepare("INSERT INTO app_settings(key,value,value_type) VALUES('sales.default_customer_id',?,'number') ON CONFLICT(key) DO UPDATE SET value=excluded.value,value_type=excluded.value_type")
      .run(String(removableId));

    assert.equal(Customer.remove(removableId).id, removableId);
    assert.equal(db.prepare("SELECT 1 FROM customers WHERE id=?").get(removableId), undefined);
    assert.equal(db.prepare("SELECT value FROM app_settings WHERE key='sales.default_customer_id'").get().value, null);

    const usedId = Number(
      db.prepare("INSERT INTO customers(name,is_active) VALUES(?,1)").run("Customer with history").lastInsertRowid,
    );
    db.prepare("INSERT INTO customer_account_entries(customer_id,entry_type,amount,description) VALUES(?,'ADJUSTMENT',1,'test')").run(usedId);
    assert.throws(() => Customer.remove(usedId), Customer.CustomerInUseError);
    assert.ok(db.prepare("SELECT 1 FROM customers WHERE id=?").get(usedId));

    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("Customer hard-delete integration test passed (transaction rolled back).");
