import assert from "node:assert/strict";
import {
  adaptiveLabelNameFont,
  buildBarcodeLabelsHtml,
  getBarcodeLabelDimensions,
} from "../../src/utils/barcodeLabelTemplate.js";
import {
  buildBarcodePrintOptions,
  comparablePrintLayout,
} from "../../src/utils/barcodePrintOptions.js";

const html = buildBarcodeLabelsHtml(
  [
    {
      designation: "Produit test",
      reference: "REF-001",
      selling_price: 100,
      barcode: "123456789012",
      quantity: 1,
    },
  ],
  {
    paper_format: "CUSTOM",
    configuration: {
      show_product_name: true,
      show_price: true,
      show_reference: true,
      label_width_mm: 72,
      label_height_mm: 35,
      name_font_size: 14,
      price_font_size: 18,
      reference_font_size: 9,
      barcode_height_mm: 16,
      price_position: "BOTTOM",
      show_barcode_text: false,
      content_gap_mm: 2,
      label_padding_mm: 3,
    },
  },
);

assert.match(html, /@page\{size:72mm 35mm portrait;margin:0\}/);
assert.match(html, /\.name\{[^}]*max-height:2\.3em/);
assert.doesNotMatch(html, /text-overflow:ellipsis/);
assert.match(
  html,
  /\.label:last-child\{page-break-after:auto;break-after:auto\}/,
);
assert.match(html, /\.price\{font-size:18px/);
assert.match(html, /\.reference\{font-size:9px/);
assert.match(html, /\.barcode\{width:100%;height:16mm/);
assert.match(html, /padding:3mm;gap:2mm/);
assert.doesNotMatch(html, /<text /);
assert.ok(html.indexOf('<div class="barcode">') < html.indexOf("100.00 DA"));
assert.equal(adaptiveLabelNameFont("Produit court", 14), 14);
assert.ok(
  adaptiveLabelNameFont(
    "Nom de produit particulièrement long qui doit tenir sur exactement deux lignes",
    14,
  ) < 14,
);
assert.deepEqual(getBarcodeLabelDimensions({ paper_format: "50x30mm" }), {
  width: 50,
  height: 30,
});
assert.deepEqual(
  getBarcodeLabelDimensions({
    paper_format: "CUSTOM",
    configuration: { label_width_mm: 72, label_height_mm: 35 },
  }),
  { width: 72, height: 35 },
);
const directOptions = buildBarcodePrintOptions(
  {
    paper_format: "CUSTOM",
    system_name: "Xprinter XP-233B",
    copies: 1,
    configuration: { label_width_mm: 43, label_height_mm: 35 },
  },
  true,
);
const manualOptions = buildBarcodePrintOptions(
  {
    paper_format: "CUSTOM",
    system_name: "Xprinter XP-233B",
    copies: 1,
    configuration: { label_width_mm: 43, label_height_mm: 35 },
  },
  false,
);
assert.equal(directOptions.silent, true);
assert.equal(manualOptions.silent, false);
assert.deepEqual(
  comparablePrintLayout(directOptions),
  comparablePrintLayout(manualOptions),
);
assert.deepEqual(directOptions.pageSize, { width: 43000, height: 35000 });
assert.equal("usePrinterDefaultPageSize" in directOptions, false);
console.log("Custom barcode label dimensions and font sizes passed.");
