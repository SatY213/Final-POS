const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Invoice = require("../services/invoice.service");
const Sales = require("../services/sales.service");

let complete = false;
try {
  db.transaction(() => {
    const stamp = Date.now();
    const warehouseId = Number(
      db
        .prepare("INSERT INTO warehouses(name) VALUES(?)")
        .run(`Invoice ${stamp}`).lastInsertRowid,
    );
    const userId = Number(
      db
        .prepare(
          "INSERT INTO users(username,password_hash,name,role,warehouse_id) VALUES(?,?,?,'manager',?)",
        )
        .run(`invoice${stamp}`, "x", "Invoice manager", warehouseId)
        .lastInsertRowid,
    );
    const customerId = Number(
      db
        .prepare("INSERT INTO customers(name) VALUES(?)")
        .run(`Invoice customer ${stamp}`).lastInsertRowid,
    );
    const actor = { id: userId, role: "manager", warehouse_id: warehouseId };
    const insertSale = db.prepare(
      "INSERT INTO sales(client_request_id,warehouse_id,customer_id,sale_number,document_type,fulfillment_type,sale_status,total,created_by,completed_at) VALUES(?,?,?,?,?,?,'CONFIRMED',?,?,CURRENT_TIMESTAMP)",
    );
    const ticketId = Number(
      insertSale.run(
        `ticket-${stamp}`,
        warehouseId,
        customerId,
        `T-${stamp}`,
        "TICKET",
        "IMMEDIATE",
        400,
        userId,
      ).lastInsertRowid,
    );
    const bonId = Number(
      insertSale.run(
        `bon-${stamp}`,
        warehouseId,
        customerId,
        `B-${stamp}`,
        "BON_POUR",
        "IMMEDIATE",
        600,
        userId,
      ).lastInsertRowid,
    );
    const insertLine = db.prepare(
      "INSERT INTO sale_lines(sale_id,line_type,designation,unit_name,conversion_factor,quantity,unit_price,subtotal,total) VALUES(?,'MISC',?,'Unité',1,1,?,?,?)",
    );
    insertLine.run(ticketId, "Article ticket", 400, 400, 400);
    insertLine.run(bonId, "Article bon", 600, 600, 600);
    delete require.cache[require.resolve("../database/migrations/init")];
    require("../database/migrations/init");
    assert.equal(
      db
        .prepare("SELECT COUNT(*) count FROM sales WHERE id IN (?,?)")
        .get(ticketId, bonId).count,
      2,
    );
    db.prepare(
      "INSERT INTO sale_payments(sale_id,payment_method_code,amount,amount_received,created_by) VALUES(?,'BANK_TRANSFER',80,80,?)",
    ).run(ticketId, userId);
    db.prepare(
      "UPDATE document_sequences SET current_value=? WHERE document_type='INVOICE'",
    ).run(stamp);

    const expectedNumber = Invoice.nextNumberPreview();
    const invoice = Invoice.createForSales(
      [ticketId, bonId],
      {
        client_request_id: `invoice-${stamp}`,
        invoice_number: expectedNumber,
        tax_enabled: true,
        tax_rate: 19,
        stamp_enabled: true,
        stamp_rate: 1,
      },
      actor,
    );
    assert.equal(invoice.invoice_number, expectedNumber);
    assert.equal(
      db
        .prepare(
          "SELECT current_value FROM document_sequences WHERE document_type='INVOICE'",
        )
        .get().current_value,
      stamp + 1,
    );
    assert.equal(invoice.total, 1200);
    assert.equal(invoice.stamp_rate, 1);
    assert.equal(invoice.stamp_amount, 10);
    assert.equal(invoice.paid_before, 80);
    assert.equal(invoice.paid_amount, 80);
    assert.equal(invoice.balance_due, 1120);
    assert.equal(invoice.payment_status, "PARTIALLY_PAID");
    assert.equal(invoice.lines.length, 2);
    assert.equal(invoice.sales.length, 2);
    assert.throws(
      () => db.prepare("DELETE FROM sales WHERE id=?").run(ticketId),
      /FOREIGN KEY constraint failed/,
    );
    assert.deepEqual(
      new Set(invoice.sales.map((sale) => sale.document_type)),
      new Set(["TICKET", "BON_POUR"]),
    );
    assert.equal(Invoice.createForSales([ticketId], {}, actor).id, invoice.id);
    const edited = Invoice.update(
      invoice.id,
      {
        invoice_number: invoice.invoice_number,
        customer_id: customerId,
        invoice_date: invoice.invoice_date,
        discount_type: "PERCENT",
        discount_value: 0,
        tax_enabled: true,
        tax_rate: 19,
        stamp_enabled: true,
        stamp_rate: 1,
        lines: invoice.lines.map((line, index) => ({
          sale_line_id: line.sale_line_id,
          quantity: line.quantity,
          unit_price: index === 0 ? 500 : line.unit_price,
          discount_type: line.discount_type,
          discount_value: line.discount_value,
        })),
      },
      actor,
    );
    assert.equal(edited.total, 1320);
    assert.equal(Sales.detail(ticketId, actor).total, 400);
    const paid = Invoice.addPayment(
      invoice.id,
      {
        client_request_id: `invoice-payment-${stamp}`,
        payment_method_code: "BANK_TRANSFER",
        amount: 120,
      },
      actor,
    );
    assert.equal(paid.paid_amount, 200);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) count FROM invoice_payments WHERE invoice_id=?",
        )
        .get(invoice.id).count,
      1,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) count FROM invoice_payment_allocations WHERE invoice_payment_id=(SELECT id FROM invoice_payments WHERE invoice_id=?)",
        )
        .get(invoice.id).count,
      1,
    );
    db.prepare(
      "INSERT INTO sale_payments(sale_id,payment_method_code,amount,amount_received,created_by) VALUES(?,'BANK_TRANSFER',50,50,?)",
    ).run(bonId, userId);
    const coordinated = Invoice.detail(invoice.id, actor);
    assert.equal(coordinated.sales_paid, 130);
    assert.equal(coordinated.new_paid, 120);
    assert.equal(coordinated.paid_amount, 250);
    assert.equal(coordinated.balance_due, 1070);
    const settled = Invoice.addPayment(
      invoice.id,
      {
        client_request_id: `invoice-payment-balance-${stamp}`,
        payment_method_code: "BANK_TRANSFER",
        amount: 1070,
      },
      actor,
    );
    assert.equal(settled.paid_amount, 1320);
    assert.equal(settled.balance_due, 0);
    assert.equal(settled.payment_status, "PAID");
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) count FROM invoice_payments WHERE invoice_id=?",
        )
        .get(invoice.id).count,
      2,
    );
    assert.equal(Sales.detail(ticketId, actor).payment_summary.balance_due, 0);
    assert.equal(Sales.detail(bonId, actor).payment_summary.balance_due, 0);
    const lowered = Invoice.update(
      invoice.id,
      {
        invoice_number: invoice.invoice_number,
        customer_id: customerId,
        invoice_date: invoice.invoice_date,
        discount_type: "PERCENT",
        discount_value: 0,
        tax_enabled: false,
        stamp_enabled: false,
        lines: settled.lines.map((line) => ({
          sale_line_id: line.sale_line_id,
          quantity: line.quantity,
          unit_price: 1,
          discount_type: "PERCENT",
          discount_value: 0,
        })),
      },
      actor,
    );
    assert.equal(lowered.total, 2);
    assert.equal(lowered.paid_amount, 1320);
    assert.equal(lowered.balance_due, 0);
    assert.equal(lowered.overpaid_amount, 1318);
    assert.equal(lowered.payment_status, "PAID");
    assert.equal(
      db
        .prepare("SELECT COUNT(*) count FROM invoice_payments WHERE invoice_id=?")
        .get(invoice.id).count,
      2,
    );
    assert.equal(
      db
        .prepare(
          "SELECT amount FROM customer_account_entries WHERE reference=? AND entry_type='ADJUSTMENT'",
        )
        .get(`INVOICE_BALANCE:${invoice.id}`).amount,
      -1318,
    );
    const increased = Invoice.update(
      invoice.id,
      {
        invoice_number: invoice.invoice_number,
        customer_id: customerId,
        invoice_date: invoice.invoice_date,
        discount_type: "PERCENT",
        discount_value: 0,
        tax_enabled: false,
        stamp_enabled: false,
        lines: lowered.lines.map((line, index) => ({
          sale_line_id: line.sale_line_id,
          quantity: line.quantity,
          unit_price: index === 0 ? 820 : 600,
          discount_type: "PERCENT",
          discount_value: 0,
        })),
      },
      actor,
    );
    assert.equal(increased.total, 1420);
    assert.equal(increased.balance_due, 100);
    assert.equal(increased.payment_status, "PARTIALLY_PAID");
    const increasedPaid = Invoice.addPayment(
      invoice.id,
      {
        client_request_id: `invoice-payment-after-edit-${stamp}`,
        payment_method_code: "BANK_TRANSFER",
        amount: 100,
      },
      actor,
    );
    assert.equal(increasedPaid.balance_due, 0);
    assert.equal(increasedPaid.paid_amount, 1420);
    assert.equal(increasedPaid.payment_status, "PAID");
    assert.equal(
      db
        .prepare("SELECT COUNT(*) count FROM invoice_payments WHERE invoice_id=?")
        .get(invoice.id).count,
      3,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) count FROM customer_account_entries WHERE reference=? AND entry_type='ADJUSTMENT'",
        )
        .get(`INVOICE_BALANCE:${invoice.id}`).count,
      0,
    );
    const invoiceList = Invoice.list({ warehouse_id: warehouseId }, actor);
    assert.equal(
      invoiceList.items.some((item) => item.id === invoice.id),
      true,
    );
    assert.equal(
      invoiceList.items.find((item) => item.id === invoice.id).balance_due,
      0,
    );
    assert.deepEqual(
      invoiceList.items
        .find((item) => item.id === invoice.id)
        .sales.map((sale) => sale.sale_number),
      [invoice.sales[0].sale_number, invoice.sales[1].sale_number],
    );
    const listed = Sales.list({ warehouse_id: warehouseId }, actor).items;
    assert.equal(
      listed.every((sale) => sale.invoice_id === invoice.id),
      true,
    );
    const unpaidSaleId = Number(
      insertSale.run(
        `unpaid-${stamp}`,
        warehouseId,
        customerId,
        `U-${stamp}`,
        "TICKET",
        "IMMEDIATE",
        100,
        userId,
      ).lastInsertRowid,
    );
    insertLine.run(unpaidSaleId, "Article non payé", 100, 100, 100);
    const unpaidInvoice = Invoice.createForSales(
      [unpaidSaleId],
      {
        client_request_id: `unpaid-invoice-${stamp}`,
        tax_enabled: false,
        stamp_enabled: false,
      },
      actor,
    );
    assert.equal(unpaidInvoice.paid_amount, 0);
    assert.equal(unpaidInvoice.balance_due, 100);
    assert.equal(unpaidInvoice.payment_status, "UNPAID");
    const popupPayment = {
      client_request_id: `payment-during-creation-${stamp}`,
      payment_method_code: "BANK_TRANSFER",
      amount: 100,
    };
    const paidDuringCreation = Invoice.addPayment(unpaidInvoice.id, popupPayment, actor);
    assert.equal(paidDuringCreation.balance_due, 0);
    assert.equal(paidDuringCreation.payment_status, "PAID");
    assert.equal(Invoice.addPayment(unpaidInvoice.id, popupPayment, actor).id, unpaidInvoice.id);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM invoice_payments WHERE invoice_id=?").get(unpaidInvoice.id).count, 1, "Double click must not duplicate a paid invoice transaction");
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log(
  "Invoice multi-sale integration test passed (transaction rolled back).",
);
