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

export function fuzzyIncludes(search, ...values) {
  const searchedTokens = tokenizeSearch(search);
  if (!searchedTokens.length) return true;
  const searchable = normalizeSearch(
    values.filter((value) => value != null).join(" "),
  );
  const compact = searchable.replace(/\s+/g, "");
  return searchedTokens.every(
    (token) => searchable.includes(token) || compact.includes(token),
  );
}
