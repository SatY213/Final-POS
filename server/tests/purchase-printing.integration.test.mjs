import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { buildCommercialPrintHtml } from "../../src/utils/commercialPrintTemplate.js";
import { buildSalePrintHtml } from "../../src/utils/salePrintTemplate.js";

const require = createRequire(import.meta.url);
const db = require("../config/database");
require("../database/migrations/init");
const Purchases = require("../services/purchase.service");
const receiptRow = db
  .prepare(
    "SELECT r.id,r.warehouse_id FROM purchase_receipts r JOIN warehouses w ON w.id=r.warehouse_id WHERE w.name LIKE 'MODERN%' ORDER BY r.id LIMIT 1",
  )
  .get();
assert.ok(receiptRow, "The demo receipt must exist");
const user = db
  .prepare(
    "SELECT id,role,warehouse_id FROM users WHERE role='admin' ORDER BY id LIMIT 1",
  )
  .get();
const receipt = Purchases.receiptDetail(receiptRow.id, {
  ...user,
  warehouse_ids: [receiptRow.warehouse_id],
});
const printable = {
  ...receipt,
  document_number: receipt.receipt_number,
  sale_number: receipt.receipt_number,
  sale_date: receipt.receipt_date,
  customer_name: receipt.supplier_name,
  customer_phone: receipt.supplier_phone,
  customer_email: receipt.supplier_email,
  customer_address: receipt.supplier_address,
  customer_nif: receipt.supplier_nif,
  customer_rib: "SUP-RIB-TEST",
  warehouse_rib: "WH-RIB-TEST",
  lines: receipt.lines,
};
const configuration = {
  show_warehouse_name: true,
  show_address: true,
  show_phone: true,
  show_email: true,
  show_customer: true,
  show_legal_info: true,
  party_label: "Fournisseur",
  title: "BON DE RÉCEPTION",
};
const a4 = buildCommercialPrintHtml(printable, {
  document_type: "PURCHASE_RECEIPT",
  paper_format: "A4",
  configuration,
});
for (const value of [
  receipt.receipt_number,
  receipt.warehouse_name,
  receipt.warehouse_address,
  receipt.warehouse_phone,
  receipt.warehouse_email,
  receipt.supplier_name,
])
  assert.ok(a4.includes(value), `${value} must appear in receipt preview`);
assert.match(a4, /INFORMATIONS FOURNISSEUR/);
assert.match(a4, /SUP-RIB-TEST/);
assert.match(a4, /WH-RIB-TEST/);
const orderRow = db
  .prepare(
    "SELECT id FROM purchase_orders WHERE warehouse_id=? ORDER BY id LIMIT 1",
  )
  .get(receiptRow.warehouse_id);
assert.ok(orderRow);
const order = Purchases.orderDetail(orderRow.id, {
  ...user,
  warehouse_ids: [receiptRow.warehouse_id],
});
assert.equal(order.print_profile.document_type, "PURCHASE_ORDER");
assert.ok(order.total > 0);
const orderHtml = buildCommercialPrintHtml(
  {
    ...order,
    document_number: order.order_number,
    sale_date: order.order_date,
    customer_name: order.supplier_name,
  },
  {
    document_type: "PURCHASE_ORDER",
    paper_format: "A4",
    configuration: { ...configuration, title: "BON DE COMMANDE" },
  },
);
assert.ok(orderHtml.includes(order.warehouse_name));
assert.ok(orderHtml.includes(order.order_number));
const ticket = buildSalePrintHtml(printable, {
  document_type: "TICKET",
  paper_format: "THERMAL_80",
  configuration,
});
for (const value of [
  receipt.warehouse_name,
  receipt.warehouse_address,
  receipt.warehouse_phone,
  receipt.warehouse_email,
  receipt.supplier_name,
])
  assert.ok(ticket.includes(value), `${value} must appear in receipt ticket`);
assert.match(ticket, /SUP-RIB-TEST/);
assert.match(ticket, /WH-RIB-TEST/);
const discounted = {
  ...printable,
  total: 180,
  lines: [
    {
      designation: "Discount sample",
      quantity: 2,
      unit_price: 100,
      discount_type: "PERCENT",
      discount_value: 10,
      total: 180,
    },
  ],
};
const hidden = buildCommercialPrintHtml(discounted, {
  document_type: "PURCHASE_RECEIPT",
  logo_data: "data:image/png;base64,iVBORw0KGgo=",
  configuration: { ...configuration, show_logo: true, show_discounts: false },
});
assert.match(hidden, /company-logo/);
assert.match(hidden, /90,00/);
assert.doesNotMatch(hidden, /<th[^>]*>Remise<\/th>/);
const shown = buildCommercialPrintHtml(discounted, {
  document_type: "PURCHASE_RECEIPT",
  configuration: { ...configuration, show_discounts: true },
});
assert.match(shown, /<th[^>]*>Remise<\/th>/);
assert.match(shown, /10%/);
const hiddenTicket = buildSalePrintHtml(discounted, {
  document_type: "TICKET",
  paper_format: "THERMAL_80",
  logo_data: "data:image/png;base64,iVBORw0KGgo=",
  configuration: { ...configuration, show_logo: true, show_discounts: false },
});
assert.match(hiddenTicket, /print-logo/);
assert.match(hiddenTicket, /90\.00/);
const invoiceSample = {
  ...discounted,
  invoice_number: "FAC-TEST",
  subtotal: 162,
  discount_amount: 18,
  tax_enabled: false,
  stamp_enabled: false,
  total: 162,
};
const invoiceHidden = buildCommercialPrintHtml(invoiceSample, {
  document_type: "INVOICE",
  configuration: { show_discounts: false },
});
assert.match(invoiceHidden, /81,00/);
assert.match(invoiceHidden, /162,00/);
assert.doesNotMatch(invoiceHidden, /Remise globale/);
const invoiceShown = buildCommercialPrintHtml(invoiceSample, {
  document_type: "INVOICE",
  configuration: { show_discounts: true },
});
assert.match(invoiceShown, /Remise globale/);
assert.match(invoiceShown, /Net HT/);
console.log(
  "Purchase receipt A4 and ticket printing include warehouse and supplier information.",
);
