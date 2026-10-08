import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import {
  buildBarcodeLabelsHtml,
  code128Svg,
  ean13CheckDigit,
  ean13Svg,
  encodeCode128,
  encodeCode128B,
  encodeEan13,
  normalizeEan13,
  recommendedBarcodeWidthMm,
} from "../src/utils/barcodeLabelTemplate.js";
import { barcodeMatches, fuzzyIncludes } from "../src/utils/search.js";

const require = createRequire(import.meta.url);
const { ean13BaseAlias, fuzzyMatch } = require("../server/utils/search.js");

test("EAN-13 calculates and validates the official check digit", () => {
  assert.equal(ean13CheckDigit("400638133393"), "1");
  assert.equal(normalizeEan13("400638133393"), "4006381333931");
  assert.equal(normalizeEan13("4006381333931"), "4006381333931");
  assert.equal(normalizeEan13("4006381333932"), null);
  assert.equal(normalizeEan13("ABC"), null);
});

test("EAN-13 uses the standard 95-module structure and quiet zones", () => {
  const encoded = encodeEan13("400638133393");
  assert.equal(encoded.modules.length, 95);
  assert.equal(encoded.modules.slice(0, 3), "101");
  assert.equal(encoded.modules.slice(45, 50), "01010");
  assert.equal(encoded.modules.slice(-3), "101");
  assert.match(ean13Svg("400638133393"), /viewBox="0 0 113 62"/);
});

test("Code 128B includes its real checksum, stop code and quiet zones", () => {
  assert.deepEqual(encodeCode128B("AB").codes, [104, 33, 34, 102, 106]);
  assert.equal(encodeCode128B("é"), null);
  assert.match(code128Svg("AB"), /viewBox="0 0 77 62"/);
});

test("numeric Code 128 automatically uses the denser Code Set C", () => {
  const encoded = encodeCode128("123456789012");
  assert.equal(encoded.codes[0], 105);
  assert.deepEqual(encoded.codes.slice(1, 7), [12, 34, 56, 78, 90, 12]);
  assert.ok(code128Svg("123456789012").includes('data-symbology="CODE128"'));
});

test("alphanumeric Code 128 compacts embedded numeric runs", () => {
  const encoded = encodeCode128("PC-2026-000123");
  assert.deepEqual(encoded.codes.slice(0, 8), [104, 48, 35, 13, 99, 20, 26, 100]);
  assert.ok(encoded.codes.includes(99), "must switch from Code B to Code C");
  assert.ok(encoded.codes.length < encodeCode128B("PC-2026-000123").codes.length);
  assert.equal(recommendedBarcodeWidthMm("PC-2026-000123"), 47);
});

test("label profile selects the requested barcode symbology", () => {
  const rows = [{ designation: "Test", barcode: "400638133393", quantity: 1 }];
  const eanHtml = buildBarcodeLabelsHtml(rows, {
    configuration: { symbology: "EAN13" },
  });
  const code128Html = buildBarcodeLabelsHtml(rows, {
    configuration: { symbology: "CODE128" },
  });
  assert.match(eanHtml, /data-symbology="EAN13"/);
  assert.match(eanHtml, /4006381333931/);
  assert.match(code128Html, /data-symbology="CODE128"/);
});

test("a scanned 13-digit EAN still finds a legacy stored 12-digit value", () => {
  assert.equal(ean13BaseAlias("4006381333931"), "400638133393");
  assert.equal(ean13BaseAlias("4006381333932"), null);
  assert.equal(fuzzyMatch("4006381333931", "400638133393"), 1);
  assert.equal(fuzzyIncludes("4006381333931", "400638133393"), true);
  assert.equal(barcodeMatches("4006381333931", ["400638133393"]), true);
  assert.equal(barcodeMatches("UNKNOWN", ["400638133393"]), false);
});
