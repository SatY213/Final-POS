/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const root = path.resolve(__dirname, "../src");
const localeFile = path.join(root, "i18n/LanguageContext.jsx");
const parse = (source) => parser.parse(source, { sourceType: "module", plugins: ["jsx"] });
const keyOf = (property) => property.computed ? null : property.key.name || property.key.value;
const definitions = new Map();
const languages = { en: new Set(), fr: new Set(), ar: new Set() };
const values = { en: new Map(), fr: new Map(), ar: new Map() };
const staticKeys = (node) => {
  if (!node) return [];
  if (node.type === "Identifier") return [...(definitions.get(node.name) || [])];
  if (node.type !== "ObjectExpression") return [];
  return node.properties.flatMap((property) => property.type === "SpreadElement"
    ? staticKeys(property.argument)
    : keyOf(property) ? [keyOf(property)] : []);
};
const staticEntries = (node) => {
  if (!node) return [];
  if (node.type === "Identifier") return [...(definitions.get(`${node.name}:entries`) || [])];
  if (node.type !== "ObjectExpression") return [];
  return node.properties.flatMap((property) => property.type === "SpreadElement"
    ? staticEntries(property.argument)
    : keyOf(property) && property.value?.type === "StringLiteral"
      ? [[keyOf(property), property.value.value]] : []);
};
traverse(parse(fs.readFileSync(path.join(root, "i18n/uiPhrases.js"), "utf8")), {
  ObjectProperty({ node }) {
    if (node.value?.type !== "ArrayExpression" || node.value.elements.length !== 2) return;
    const key = keyOf(node);
    const [english, arabic] = node.value.elements;
    if (!key || english?.type !== "StringLiteral" || arabic?.type !== "StringLiteral") return;
    for (const language of ["en", "fr", "ar"]) languages[language].add(key);
    values.en.set(key, english.value);
    values.fr.set(key, key === "Close" ? "Fermer" : key);
    values.ar.set(key, arabic.value);
  },
});
traverse(parse(fs.readFileSync(localeFile, "utf8")), {
  VariableDeclarator({ node }) {
    if (node.id.type === "Identifier" && node.init?.type === "ObjectExpression") {
      const keys = staticKeys(node.init);
      definitions.set(node.id.name, keys);
      const entries = staticEntries(node.init);
      definitions.set(`${node.id.name}:entries`, entries);
      if (languages[node.id.name]) {
        keys.forEach((key) => languages[node.id.name].add(key));
        entries.forEach(([key, value]) => values[node.id.name].set(key, value));
      }
    }
  },
  CallExpression({ node }) {
    if (node.callee.type !== "MemberExpression" || node.callee.object.name !== "Object" || node.callee.property.name !== "assign") return;
    const locale = node.arguments[0]?.name;
    if (languages[locale]) {
      node.arguments.slice(1).flatMap(staticKeys).forEach((key) => languages[locale].add(key));
      node.arguments.slice(1).flatMap(staticEntries).forEach(([key, value]) => values[locale].set(key, value));
    }
  },
});

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? files(name) : /\.[jt]sx?$/.test(entry.name) ? [name] : [];
  });
}
const used = new Map();
const hardcoded = [];
const dynamicText = [];
const contextualText = [];
const contextualTemplates = [];
const nonJsxFrench = [];
const dynamicKeys = [];
const replacements = [];
const textAttributes = new Set(["placeholder", "searchPlaceholder", "title", "aria-label", "alt", "label", "message", "description", "confirmLabel", "cancelLabel"]);
const record = (file, node, kind, value) => hardcoded.push(`${path.relative(root, file)}:${node.loc.start.line} ${kind} ${JSON.stringify(value)}`);
const matchingKey = (phrase) => {
  if (values.fr.has(phrase) && values.en.has(phrase) && values.ar.has(phrase)) return phrase;
  const matches = [...values.fr].filter(([key, value]) => value.trim().toLocaleLowerCase() === phrase.trim().toLocaleLowerCase()
    && values.en.has(key) && values.ar.has(key));
  return matches.length === 1 ? matches[0][0] : null;
};
const sourceFiles = files(root).filter((file) => file !== localeFile
  && !(file.includes(`${path.sep}utils${path.sep}`) && file.includes("PrintTemplate")));
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const ast = parse(source);
  const edits = [];
  traverse(ast, {
    CallExpression({ node }) {
      if (node.callee.type !== "Identifier" || node.callee.name !== "t") return;
      if (node.arguments[0]?.type === "TemplateLiteral") {
        dynamicKeys.push(`${path.relative(root, file)}:${node.loc.start.line} ${source.slice(node.arguments[0].start, node.arguments[0].end)}`);
        return;
      }
      if (node.arguments[0]?.type !== "StringLiteral") return;
      const key = node.arguments[0].value;
      if (!used.has(key)) used.set(key, []);
      used.get(key).push(`${path.relative(root, file)}:${node.loc.start.line}`);
    },
    JSXText(path) {
      const { node } = path;
      const value = node.value.replace(/\s+/g, " ").trim();
      if (/[A-Za-z\u00c0-\u024f\u0600-\u06ff]/.test(value) && value.length > 1) {
        record(file, node, "text", value);
        const key = matchingKey(value);
        if (key && path.scope.hasBinding("t") && !source.slice(node.start, node.end).trim().includes("\n")) {
          const original = source.slice(node.start, node.end);
          const trimmed = original.trim();
          edits.push({ start: node.start, end: node.end, replacement: original.replace(trimmed, `{t(${JSON.stringify(key)})}`) });
        }
      }
    },
    JSXAttribute(path) {
      const { node } = path;
      const name = node.name.name;
      if (textAttributes.has(name) && node.value?.type === "StringLiteral" && /[A-Za-z\u00c0-\u024f\u0600-\u06ff]/.test(node.value.value)) {
        record(file, node, name, node.value.value);
        const key = matchingKey(node.value.value);
        if (key && path.scope.hasBinding("t")) edits.push({ start: node.value.start, end: node.value.end, replacement: `{t(${JSON.stringify(key)})}` });
      }
    },
    StringLiteral(literalPath) {
      if (literalPath.parentPath.isJSXAttribute()) return;
      const jsx = literalPath.findParent((ancestor) => ancestor.isJSXExpressionContainer());
      if (!jsx) {
        const parent = literalPath.parentPath;
        const directCall = parent.isCallExpression() && parent.node.arguments.includes(literalPath.node) ? parent.node.callee : null;
        const callName = directCall?.name || directCall?.property?.name;
        const property = parent.isObjectProperty() && parent.node.value === literalPath.node ? keyOf(parent.node) : null;
        if (["setError", "setSuccess", "setWarning", "alert", "confirm", "prompt"].includes(callName)
          || ["label", "title", "message", "description", "placeholder", "searchPlaceholder", "confirmLabel", "cancelLabel"].includes(property)) {
          const value = literalPath.node.value.trim();
          if (value && !/^(?:[.#/]|https?:|rgb|data:)/.test(value)) contextualText.push(`${path.relative(root, file)}:${literalPath.node.loc.start.line} ${callName || property} ${JSON.stringify(value)}`);
        }
        if (/\b[\p{L}]{2,}\s+[\p{L}]{2,}/u.test(literalPath.node.value) && /[\u00c0-\u024f]/.test(literalPath.node.value)
          && !literalPath.findParent((ancestor) => ancestor.isCallExpression() && ancestor.node.callee.name === "t")
          && !parent.isImportDeclaration() && !parent.isExportNamedDeclaration() && !(parent.isObjectProperty() && parent.node.key === literalPath.node)) {
          nonJsxFrench.push(`${path.relative(root, file)}:${literalPath.node.loc.start.line} ${JSON.stringify(literalPath.node.value)}`);
        }
        return;
      }
      if (literalPath.findParent((ancestor) => ancestor.isCallExpression() && ancestor.node.callee.name === "t")) return;
      const attribute = literalPath.findParent((ancestor) => ancestor.isJSXAttribute())?.node.name.name;
      if (attribute && !textAttributes.has(attribute)) return;
      const value = literalPath.node.value.trim();
      if (value.length < 6 || !(/[\u00c0-\u024f\u0600-\u06ff]/.test(value) || /[A-Za-z]{2,} [A-Za-z]{2,}/.test(value))) return;
      if (/^(?:[A-Z_]{3,}$|https?:|[.#/]|rgb|data:)/.test(value)) return;
      dynamicText.push(`${path.relative(root, file)}:${literalPath.node.loc.start.line} ${JSON.stringify(value)}`);
      const key = matchingKey(value);
      if (key && literalPath.scope.hasBinding("t")) edits.push({ start: literalPath.node.start, end: literalPath.node.end, replacement: `t(${JSON.stringify(key)})` });
    },
    TemplateLiteral(templatePath) {
      if (templatePath.findParent((ancestor) => ancestor.isCallExpression() && ancestor.node.callee.name === "t")) return;
      const parent = templatePath.parentPath;
      const jsx = templatePath.findParent((ancestor) => ancestor.isJSXExpressionContainer());
      const call = parent.isCallExpression() && parent.node.arguments.includes(templatePath.node) ? parent.node.callee : null;
      const callName = call?.name || call?.property?.name;
      if (!jsx && !["setError", "setSuccess", "setWarning", "alert", "confirm", "prompt"].includes(callName)) return;
      const value = templatePath.node.quasis.map((part) => part.value.cooked).join("{}").trim();
      if (value.length < 5 || !(/[\u00c0-\u024f\u0600-\u06ff]/.test(value) || /[A-Za-z]{2,} [A-Za-z]{2,}/.test(value))) return;
      const attribute = templatePath.findParent((ancestor) => ancestor.isJSXAttribute())?.node.name.name;
      if (attribute && !textAttributes.has(attribute)) return;
      contextualTemplates.push(`${path.relative(root, file)}:${templatePath.node.loc.start.line} ${JSON.stringify(value)}`);
    },
  });
  if (edits.length) {
    let updated = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) updated = updated.slice(0, edit.start) + edit.replacement + updated.slice(edit.end);
    const before = source.split(/\r?\n/), after = updated.split(/\r?\n/);
    if (before.length !== after.length) throw new Error(`Translation codemod changed line count: ${file}`);
    replacements.push({ file: path.relative(path.resolve(root, ".."), file).replaceAll("\\", "/"), lines: before.flatMap((line, index) => line !== after[index] ? [{ old: line, new: after[index] }] : []) });
  }
}
const expectedDynamic = new Set([
  ...["sales", "payments", "invoicing", "cash"].flatMap((group) => [`${group}Settings`, `${group}SettingsDescription`]),
  ...["admin", "manager", "cashier", "stock"].map((role) => `role_${role}`),
  ...["SALE_PAYMENT", "INVOICE_PAYMENT", "SUPPLIER_PAYMENT", "PURCHASE_PAYMENT", "CUSTOMER_RETURN_REFUND", "SUPPLIER_RETURN_REFUND"].map((source) => `transaction_${source}`),
  ...["LOW_STOCK", "OUT_OF_STOCK", "EXPIRATION", "CUSTOMER_DUE", "SUPPLIER_DUE"].map((alert) => `alert_${alert}`),
  ...["today", "week", "month", "year", "custom"].map((period) => `period_${period}`),
  ...["overview", "sales", "purchases", "customers", "suppliers", "stock", "finance"].map((report) => `report_${report}`),
  ...["default_fulfillment_type", "default_print_document", "default_print_format", "default_customer_id", "allow_default_customer", "allow_price_edit", "allow_discount", "max_discount_percent", "quick_checkout_enabled", "quick_checkout_payment_method", "quick_checkout_exact_amount_only", "scan_add_immediately", "existing_product_behavior", "allow_negative_stock", "tax_enabled", "tax_rate", "stamp_enabled", "stamp_rate"].map((field) => `settingDescription_${field}`),
]);
traverse(parse(fs.readFileSync(path.join(root, "pages/Settings/tabs/configuration/ConfigurationTabs.jsx"), "utf8")), {
  ObjectProperty({ node }) {
    if (keyOf(node) === "key" && node.value?.type === "StringLiteral") expectedDynamic.add(`setting_${node.value.value}`);
  },
});
for (const key of expectedDynamic) {
  if (!used.has(key)) used.set(key, ["dynamic UI key"]);
}
if (process.argv.includes("--existing-patch")) {
  process.stdout.write(JSON.stringify(replacements));
  process.exit(0);
}
const missing = [...used].flatMap(([key, locations]) => Object.entries(languages)
  .filter(([, keys]) => !keys.has(key))
  .map(([language]) => `${language} ${key} ${locations[0]}`));
const suggestions = hardcoded.map((line) => {
  const match = line.match(/^(.*?) (?:text|placeholder|title|aria-label|alt|label|message|description|confirmLabel|cancelLabel) (".*")$/);
  if (!match) return null;
  const phrase = JSON.parse(match[2]).trim();
  const keys = [...values.fr].filter(([, value]) => value.trim().toLocaleLowerCase() === phrase.toLocaleLowerCase()).map(([key]) => key);
  return keys.length ? `${match[1]} ${JSON.stringify(phrase)} => ${keys.slice(0, 3).join(", ")}` : null;
}).filter(Boolean);
if (process.argv.includes("--check")) {
  const technical = /^(?:CSV UTF-8|Excel|Word|F\d+|Ctrl\+Enter ·|DA|DZD|POS Modern|A4|A5|#ATT-|\(x|CODE128|EAN13|24 h|12 h|SN-0001\\nSN-0002|DZD \d[\d .]*|\d[\d .]* (?:DA|DZD))$/;
  const unexpected = hardcoded.filter((line) => {
    const match = line.match(/ (".*")$/);
    return !match || !technical.test(JSON.parse(match[1]));
  });
  console.log(`Translation keys checked: ${used.size}; missing: ${missing.length}; untranslated UI literals: ${unexpected.length}.`);
  if (missing.length) console.log(missing.join("\n"));
  if (unexpected.length) console.log(unexpected.join("\n"));
  if (missing.length || unexpected.length) process.exitCode = 1;
  process.exit();
}
console.log(`Checked ${sourceFiles.length} UI source files and ${used.size} translation keys (print templates excluded).`);
console.log(`Missing keys (${missing.length}):\n${missing.join("\n")}`);
console.log(`Existing-key matches (${suggestions.length}):\n${suggestions.join("\n")}`);
console.log(`Hard-coded JSX text/attributes (${hardcoded.length}):\n${hardcoded.join("\n")}`);
console.log(`Possible hard-coded expression text (${dynamicText.length}):\n${dynamicText.join("\n")}`);
console.log(`Possible hard-coded contextual text (${contextualText.length}):\n${contextualText.join("\n")}`);
console.log(`Possible hard-coded templates (${contextualTemplates.length}):\n${contextualTemplates.join("\n")}`);
console.log(`Other French literals outside JSX (${nonJsxFrench.length}):\n${nonJsxFrench.join("\n")}`);
console.log(`Dynamic translation keys (${dynamicKeys.length}):\n${dynamicKeys.join("\n")}`);
if (missing.length) process.exitCode = 1;
