import assert from "node:assert/strict";
import {buildSalePrintHtml} from "../../src/utils/salePrintTemplate.js";
const sale={sale_number:"VNT-2026-000021",sale_date:"2026-08-31",customer_name:"Client",total:1000,lines:[{designation:"Produit historique",quantity:2,unit_price:500,total:1000}],return_summary:{return_total:200}};
for(const document_type of ["TICKET","SALES_INVOICE","DELIVERY_NOTE"])for(const paper_format of ["A4","THERMAL_80"]){const html=buildSalePrintHtml(sale,{document_type,paper_format,configuration:{}});assert.match(html,/VNT-2026-000021/);assert.match(html,/Produit historique/);assert.match(html,/Net après retours/);assert.doesNotMatch(html,/FAC-|BL-/)}
assert.equal(sale.total,1000);assert.equal(sale.lines[0].quantity,2);console.log("Sales printing template test passed (6 document/format combinations, no mutation).");
const netHtml = buildSalePrintHtml({ ...sale, total: 90, return_summary: null, lines: [{ designation: "Item", quantity: 1, unit_price: 100, total: 100 }] }, { document_type: "BON_POUR", paper_format: "THERMAL_80", configuration: { show_discounts: false } });
assert.match(netHtml, /90\.00<\/td>/);
assert.doesNotMatch(netHtml, /Remise/);
const legalInfoHtml = buildSalePrintHtml(
  {
    ...sale,
    warehouse_name: "Warehouse RIB test",
    warehouse_rib: "WH-001",
    customer_name: "Customer RIB test",
    customer_nif: "NIF-001",
    customer_nis: "NIS-001",
    customer_rib: "CU-001",
  },
  {
    document_type: "TICKET",
    paper_format: "THERMAL_80",
    configuration: {
      show_warehouse_name: true,
      show_legal_info: true,
      show_customer: true,
    },
  },
);
assert.match(legalInfoHtml, /RIB: WH-001/);
assert.match(legalInfoHtml, /NIF: NIF-001/);
assert.match(legalInfoHtml, /NIS: NIS-001/);
assert.match(legalInfoHtml, /RIB: CU-001/);
