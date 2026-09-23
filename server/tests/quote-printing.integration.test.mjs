import assert from "node:assert/strict";
import { buildCommercialPrintHtml } from "../../src/utils/commercialPrintTemplate.js";

const quote = {
  quote_number: "DEV-2026-000001",
  customer_name: "Client test",
  total: 1250,
  lines: [
    {
      designation: "Produit test",
      quantity: 2,
      unit_name: "Pièce",
      total: 1250,
    },
  ],
};

for (const paper_format of ["A4", "A5", "80mm", "58mm"]) {
  const html = buildCommercialPrintHtml(quote, { paper_format });
  assert.match(html, /DEV-2026-000001/);
  assert.match(html, /Produit test/);
  assert.match(html, /1(?:\u202f|&nbsp;|\s)250,00 DA/);
}

console.log("Quote preview and print formats passed.");
