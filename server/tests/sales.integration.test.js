const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Sales = require("../services/sales.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now(),
      warehouse = Number(
        db
          .prepare("INSERT INTO warehouses(name) VALUES(?)")
          .run(`Sales ${stamp}`).lastInsertRowid,
      ),
      otherWarehouse = Number(
        db
          .prepare("INSERT INTO warehouses(name) VALUES(?)")
          .run(`Other ${stamp}`).lastInsertRowid,
      ),
      seller = Number(
        db
          .prepare(
            "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'cashier',?)",
          )
          .run(`sales${stamp}`, "x", "Sales Seller", warehouse).lastInsertRowid,
      ),
      customer = Number(
        db
          .prepare("INSERT INTO customers(name) VALUES(?)")
          .run(`Sales Customer ${stamp}`).lastInsertRowid,
      ),
      actor = { id: seller, role: "cashier", warehouse_id: warehouse };
    const insertSale = db.prepare(
      `INSERT INTO sales(client_request_id,warehouse_id,customer_id,sale_number,fulfillment_type,sale_status,sale_date,subtotal,total,customer_reference,created_by,completed_at)
       VALUES(?,?,?,?,?,'CONFIRMED',?,?,?,?,?,CURRENT_TIMESTAMP)`,
    );
    const first = Number(
        insertSale.run(
          `sales-a-${stamp}`,
          warehouse,
          customer,
          `VNT-A-${stamp}`,
          "IMMEDIATE",
          "2026-08-01",
          100,
          119,
          "REF-A",
          seller,
        ).lastInsertRowid,
      ),
      second = Number(
        insertSale.run(
          `sales-b-${stamp}`,
          warehouse,
          null,
          `VNT-B-${stamp}`,
          "IMMEDIATE",
          "2026-08-20",
          200,
          200,
          null,
          seller,
        ).lastInsertRowid,
      ),
      hidden = Number(
        insertSale.run(
          `sales-c-${stamp}`,
          otherWarehouse,
          null,
          `VNT-C-${stamp}`,
          "IMMEDIATE",
          "2026-08-20",
          500,
          500,
          null,
          seller,
        ).lastInsertRowid,
      );
    db.prepare(
      `INSERT INTO sale_lines(sale_id,line_type,designation,unit_name,conversion_factor,quantity,unit_price,discount_amount,subtotal,total)
       VALUES(?,'MISC','Historical name','Unit',1,1,100,0,100,100)`,
    ).run(first);
    db.prepare(
      "INSERT INTO sale_payments(sale_id,payment_method_code,amount,created_by) VALUES(?,?,?,?)",
    ).run(first, "CASH", 50, seller);
    db.prepare(
      "INSERT INTO sale_payments(sale_id,payment_method_code,amount,created_by) VALUES(?,?,?,?)",
    ).run(first, "CARD", 69, seller);
    db.prepare(
      "INSERT INTO sale_payments(sale_id,payment_method_code,amount,created_by) VALUES(?,?,?,?)",
    ).run(second, "CARD", 200, seller);

    let result = Sales.list(
      { warehouse_id: warehouse, page: 1, limit: 10 },
      actor,
    );
    assert.equal(result.summary.count, 2);
    assert.equal(result.summary.total_amount, 319);
    assert.equal(result.items.length, 2);
    result = Sales.list({ warehouse_id: warehouse, from: "2026-08-10" }, actor);
    assert.deepEqual(
      result.items.map((item) => item.id),
      [second],
    );
    result = Sales.list({ warehouse_id: warehouse, to: "2026-08-10" }, actor);
    assert.deepEqual(
      result.items.map((item) => item.id),
      [first],
    );
    assert.equal(
      Sales.list({ warehouse_id: warehouse, customer_id: customer }, actor)
        .summary.count,
      1,
    );
    assert.equal(
      Sales.list({ warehouse_id: warehouse, seller_id: seller }, actor).summary
        .count,
      2,
    );
    assert.equal(
      Sales.list(
        { warehouse_id: warehouse, payment_method_code: "CASH" },
        actor,
      ).summary.count,
      1,
    );
    assert.equal(
      Sales.list({ warehouse_id: warehouse, search: "REF-A" }, actor).items[0]
        .id,
      first,
    );
    const detail = Sales.detail(first, actor);
    assert.equal(detail.lines[0].designation, "Historical name");
    assert.equal(detail.payments.length, 2);
    assert.throws(() => Sales.detail(hidden, actor), /cannot access/);
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("Sales integration test passed (transaction rolled back).");
