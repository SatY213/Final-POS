import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { calculateCheckoutPayment } from "../../src/utils/posPayment.js";

const require = createRequire(import.meta.url);
const db = require("../config/database");
require("../database/migrations/init");
const Pos = require("../services/pos.service");
const Account = require("../services/customer-account.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouse = Number(
      db
        .prepare(
          "INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)",
        )
        .run(`Single payment ${stamp}`).lastInsertRowid,
    );
    const userId = Number(
      db
        .prepare(
          "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)",
        )
        .run(`singlepay${stamp}`, "x", "Single payment", warehouse)
        .lastInsertRowid,
    );
    const actor = { id: userId, role: "manager", warehouse_id: warehouse };
    const register = Number(
      db
        .prepare(
          "INSERT INTO cash_registers(warehouse_id,name,code) VALUES(?,?,?)",
        )
        .run(warehouse, "Single", `SINGLE-${stamp}`).lastInsertRowid,
    );
    db.prepare(
      "INSERT INTO cash_sessions(cash_register_id,user_id,opening_cash) VALUES(?,?,0)",
    ).run(register, userId);
    const unit = Number(
      db
        .prepare("INSERT INTO units(name,symbol) VALUES(?,?)")
        .run(`Single unit ${stamp}`, "u").lastInsertRowid,
    );
    const product = Number(
      db
        .prepare(
          "INSERT INTO products(designation,unit_id,track_stock) VALUES(?,?,0)",
        )
        .run("Exact payment product", unit).lastInsertRowid,
    );
    const productUnit = Number(
      db
        .prepare(
          "INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base) VALUES(?,?,1,0,2962.88,1)",
        )
        .run(product, unit).lastInsertRowid,
    );
    const line = {
      product_id: product,
      product_unit_id: productUnit,
      quantity: 1,
      unit_price: 2962.88,
    };
    const cardProduct = Number(
      db
        .prepare(
          "INSERT INTO products(designation,unit_id,track_stock) VALUES(?,?,0)",
        )
        .run("Card payment product", unit).lastInsertRowid,
    );
    const cardProductUnit = Number(
      db
        .prepare(
          "INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base) VALUES(?,?,1,0,10000,1)",
        )
        .run(cardProduct, unit).lastInsertRowid,
    );
    const cardLine = {
      product_id: cardProduct,
      product_unit_id: cardProductUnit,
      quantity: 1,
      unit_price: 10000,
    };
    const createCustomer = (name) =>
      Number(
        db
          .prepare("INSERT INTO customers(name,is_active) VALUES(?,1)")
          .run(`${name} ${stamp}`).lastInsertRowid,
      );
    const cash = db
      .prepare("SELECT * FROM payment_methods WHERE code='CASH'")
      .get();
    const card = db
      .prepare("SELECT * FROM payment_methods WHERE code='CARD'")
      .get();
    const finalizeFromUi = ({
      request,
      customerId = null,
      calculation,
      method,
      saleLine = line,
    }) =>
      Pos.finalize(
        {
          client_request_id: `${request}-${stamp}`,
          warehouse_id: warehouse,
          customer_id: customerId,
          fulfillment_type: "IMMEDIATE",
          lines: [saleLine],
          leave_unpaid: calculation.remaining > 0,
          payments:
            calculation.paid > 0
              ? [
                  {
                    code: method.code,
                    amount: calculation.paid,
                    amount_received: calculation.received,
                  },
                ]
              : [],
        },
        actor,
      );

    const partialCustomer = createCustomer("Partial cash");
    const partialCalculation = calculateCheckoutPayment({
      total: 2962.88,
      method: cash,
      amountReceived: 1000,
    });
    assert.deepEqual(partialCalculation, {
      payableTotal: 2962.88,
      paid: 1000,
      received: 1000,
      change: 0,
      remaining: 1962.88,
    });
    const partial = finalizeFromUi({
      request: "partial",
      customerId: partialCustomer,
      calculation: partialCalculation,
      method: cash,
    });
    assert.equal(partial.total, 2962.88);
    assert.equal(partial.payment_summary.paid_total, 1000);
    assert.equal(partial.payment_summary.balance_due, 1962.88);
    assert.equal(partial.payment_status, "PARTIALLY_PAID");
    assert.equal(partial.payments.length, 1);
    assert.equal(partial.payments[0].payment_method_code, "CASH");
    assert.equal(partial.payments[0].amount, 1000);
    assert.equal(Account.summary(partialCustomer).receivable, 1962.88);

    const noCustomerCalculation = calculateCheckoutPayment({
      total: 2962.88,
      method: cash,
      amountReceived: 1000,
    });
    assert.throws(
      () =>
        finalizeFromUi({
          request: "no-customer",
          calculation: noCustomerCalculation,
          method: cash,
        }),
      /sélectionner un client/i,
    );

    const fullCustomer = createCustomer("Full cash");
    const fullCalculation = calculateCheckoutPayment({
      total: 2962.88,
      method: cash,
      amountReceived: 3000,
    });
    assert.deepEqual(fullCalculation, {
      payableTotal: 2962.88,
      paid: 2962.88,
      received: 3000,
      change: 37.12,
      remaining: 0,
    });
    const full = finalizeFromUi({
      request: "full",
      customerId: fullCustomer,
      calculation: fullCalculation,
      method: cash,
    });
    assert.equal(full.payment_status, "PAID");
    assert.equal(full.payments[0].amount, 2962.88);
    assert.equal(full.payments[0].amount_received, 3000);
    assert.equal(full.payments[0].change_amount, 37.12);
    assert.equal(Account.summary(fullCustomer).receivable, 0);

    const cardCustomer = createCustomer("Partial card");
    const cardCalculation = calculateCheckoutPayment({
      total: 10000,
      method: card,
      amount: 6000,
    });
    const cardSale = finalizeFromUi({
      request: "card",
      customerId: cardCustomer,
      calculation: cardCalculation,
      method: card,
      saleLine: cardLine,
    });
    assert.equal(cardSale.payments.length, 1);
    assert.equal(cardSale.payments[0].amount, 6000);
    assert.equal(cardSale.payment_summary.balance_due, 4000);
    assert.equal(cardSale.payment_status, "PARTIALLY_PAID");
    assert.equal(Account.summary(cardCustomer).receivable, 4000);

    assert.throws(
      () =>
        Pos.finalize(
          {
            client_request_id: `split-${stamp}`,
            warehouse_id: warehouse,
            customer_id: cardCustomer,
            fulfillment_type: "IMMEDIATE",
            lines: [line],
            payments: [
              { code: "CASH", amount: 1000, amount_received: 1000 },
              { code: "CARD", amount: 1962.88 },
            ],
          },
          actor,
        ),
      /one payment method/i,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) count FROM payment_methods WHERE code='CUSTOMER_CREDIT' AND is_active=1",
        )
        .get().count,
      0,
    );

    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("POS single-payment UI calculation and backend flow passed.");
