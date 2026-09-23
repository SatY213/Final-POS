import assert from "node:assert/strict";
import {buildBarcodeLabelsHtml,code128Svg} from "../../src/utils/barcodeLabelTemplate.js";
const svg=code128Svg("123456789012");assert.match(svg,/<svg/);assert.ok((svg.match(/<rect/g)||[]).length>20);assert.match(svg,/123456789012/);
const rows=[{id:1,designation:"Produit A",reference:"REF-A",selling_price:1200,barcode:"123456789012",quantity:2},{id:2,designation:"Produit B",reference:"REF-B",selling_price:500,barcode:"ABC-002",quantity:3}],profile={paper_format:"50x30mm",configuration:{show_product_name:true,show_price:true,show_reference:true}};
const html=buildBarcodeLabelsHtml(rows,profile);assert.equal((html.match(/<article class="label">/g)||[]).length,5);assert.match(html,/Produit A/);assert.match(html,/1200.00 DA/);assert.match(html,/Réf. REF-B/);assert.match(html,/@page\{size:50mm 30mm/);assert.equal(rows[0].quantity,2);console.log("Barcode label template test passed (Code 128, quantities and profile dimensions).");
