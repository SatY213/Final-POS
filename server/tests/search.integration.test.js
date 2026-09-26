"use strict";

const assert = require("assert");
const {
  normalizeSearch,
  tokenizeSearch,
  fuzzyMatch,
} = require("../utils/search");

assert.deepStrictEqual(tokenizeSearch("  Écran-32GO, ADATA  "), [
  "ecran",
  "32",
  "go",
  "adata",
]);
assert.deepStrictEqual(tokenizeSearch("adata32"), ["adata", "32"]);
assert.strictEqual(fuzzyMatch("32go adata", "Disque ADATA", "SSD-32-GO"), 1);
assert.strictEqual(fuzzyMatch("ecran hp", "Écran LED", "HP-24"), 1);
assert.strictEqual(fuzzyMatch("hp ecran", "Écran LED", "HP-24"), 1);
assert.strictEqual(fuzzyMatch("samsung", "Écran LED", "HP-24"), 0);
assert.strictEqual(fuzzyMatch("هاتف 15", "هاتف ذكي", "IPHONE15"), 1);
assert.strictEqual(normalizeSearch("N° FAC-2026/001"), "n fac 2026 001");

console.log("Reusable fuzzy search tests: OK");
