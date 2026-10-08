export function normalizeSearch(input) {
  return String(input ?? "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([^\p{N}])(\p{N})/gu, "$1 $2")
    .replace(/(\p{N})([^\p{N}])/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenizeSearch(input) {
  const normalized = normalizeSearch(input);
  return normalized ? normalized.split(" ") : [];
}

export function ean13BaseAlias(value) {
  const digits = String(value ?? "").replace(/\s+/g, "");
  if (!/^\d{13}$/.test(digits)) return null;
  const sum = [...digits.slice(0, 12)].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  const checkDigit = String((10 - (sum % 10)) % 10);
  return checkDigit === digits[12] ? digits.slice(0, 12) : null;
}

function ean13FullAlias(value) {
  const digits = String(value ?? "").replace(/\s+/g, "");
  if (!/^\d{12}$/.test(digits)) return null;
  const sum = [...digits].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  return `${digits}${(10 - (sum % 10)) % 10}`;
}

export function barcodeMatches(search, values) {
  const scanned = String(search ?? "").trim();
  if (!scanned) return false;
  const candidates = new Set(
    (Array.isArray(values) ? values : [values])
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
  if (candidates.has(scanned)) return true;
  const base = ean13BaseAlias(scanned);
  if (base && candidates.has(base)) return true;
  const full = ean13FullAlias(scanned);
  return Boolean(full && candidates.has(full));
}

export function fuzzyIncludes(search, ...values) {
  const searchedTokens = tokenizeSearch(search);
  if (!searchedTokens.length) return true;
  const searchable = normalizeSearch(
    values.filter((value) => value != null).join(" "),
  );
  const compact = searchable.replace(/\s+/g, "");
  return searchedTokens.every((token) => {
    const eanBase = ean13BaseAlias(token);
    return (
      searchable.includes(token) ||
      compact.includes(token) ||
      (eanBase && (searchable.includes(eanBase) || compact.includes(eanBase)))
    );
  });
}
