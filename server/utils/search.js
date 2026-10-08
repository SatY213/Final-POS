"use strict";

const normalizedCache = new Map();

function normalizeSearch(input) {
  const raw = String(input ?? "");
  const cached = normalizedCache.get(raw);
  if (cached !== undefined) return cached;
  const normalized = raw
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([^\p{N}])(\p{N})/gu, "$1 $2")
    .replace(/(\p{N})([^\p{N}])/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (raw.length <= 512) {
    if (normalizedCache.size >= 50_000) normalizedCache.clear();
    normalizedCache.set(raw, normalized);
  }
  return normalized;
}

function tokenizeSearch(input) {
  const normalized = normalizeSearch(input);
  return normalized ? normalized.split(" ") : [];
}

function ean13BaseAlias(value) {
  const digits = String(value ?? "").replace(/\s+/g, "");
  if (!/^\d{13}$/.test(digits)) return null;
  const sum = [...digits.slice(0, 12)].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  const checkDigit = String((10 - (sum % 10)) % 10);
  return checkDigit === digits[12] ? digits.slice(0, 12) : null;
}

function fuzzyMatch(input, ...values) {
  const searchedTokens = tokenizeSearch(input);
  if (!searchedTokens.length) return 1;
  const searchable = normalizeSearch(
    values.filter((value) => value != null).join(" "),
  );
  if (!searchable) return 0;
  const compact = searchable.replace(/\s+/g, "");
  return searchedTokens.every((token) => {
    const eanBase = ean13BaseAlias(token);
    return (
      searchable.includes(token) ||
      compact.includes(token) ||
      (eanBase && (searchable.includes(eanBase) || compact.includes(eanBase)))
    );
  })
    ? 1
    : 0;
}

function registerSearchFunctions(db) {
  db.function(
    "fuzzy_match",
    { deterministic: true, varargs: true },
    fuzzyMatch,
  );
}

module.exports = {
  normalizeSearch,
  tokenizeSearch,
  ean13BaseAlias,
  fuzzyMatch,
  registerSearchFunctions,
};
