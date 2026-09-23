/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const root = path.resolve(__dirname, "..");
const parse = (file) => parser.parse(fs.readFileSync(file, "utf8"), { sourceType: "unambiguous" });
const languages = { en: new Set(), fr: new Set(), ar: new Set() };
const propertyName = (node) => node.key?.name || node.key?.value;
const collect = (locale, object) => {
  if (!languages[locale] || object?.type !== "ObjectExpression") return;
  object.properties.forEach((property) => {
    if (property.type === "ObjectProperty") languages[locale].add(propertyName(property));
  });
};
traverse(parse(path.join(root, "src/i18n/errorMessages.js")), {
  VariableDeclarator({ node }) {
    if (node.init?.type !== "ObjectExpression") return;
    node.init.properties.forEach((property) => collect(propertyName(property), property.value));
  },
  CallExpression({ node }) {
    if (node.callee.type !== "MemberExpression" || node.callee.object.name !== "Object" || node.callee.property.name !== "assign") return;
    const target = node.arguments[0];
    if (target?.object?.name === "translations") collect(target.property.name, node.arguments[1]);
  },
});

const messages = new Map();
const templates = new Map();
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.js$/.test(entry.name)) {
      traverse(parse(file), {
        ObjectProperty({ node }) {
          if (propertyName(node) !== "message" || node.value.type !== "StringLiteral") return;
          add(node.value.value, file, node.loc.start.line);
        },
        NewExpression({ node }) {
          if (!node.callee.name?.endsWith("Error")) return;
          if (node.arguments[0]?.type === "StringLiteral") add(node.arguments[0].value, file, node.loc.start.line);
          if (node.arguments[0]?.type === "TemplateLiteral") {
            const template = node.arguments[0].quasis.map((part) => part.value.cooked).join("{}");
            templates.set(template, `${path.relative(root, file)}:${node.loc.start.line}`);
          }
        },
      });
    }
  }
}
function add(message, file, line) {
  if (!message.trim()) return;
  if (!messages.has(message)) messages.set(message, []);
  messages.get(message).push(`${path.relative(root, file)}:${line}`);
}
["controllers", "services", "models", "middleware"].forEach((folder) => walk(path.join(root, "server", folder)));
const missing = [...messages].flatMap(([message, locations]) => {
  const absent = Object.entries(languages).filter(([lang, keys]) => lang !== "en" && !keys.has(message)).map(([lang]) => lang);
  return absent.length ? [`${absent.join(",")} ${JSON.stringify(message)} ${locations[0]}`] : [];
});
console.log(`Server messages: ${messages.size}; missing translation entries: ${missing.length}`);
if (missing.length || !process.argv.includes("--check")) console.log(missing.join("\n"));
if (!process.argv.includes("--check")) {
  console.log(`Dynamic error templates: ${templates.size}`);
  console.log([...templates].map(([template, location]) => `${JSON.stringify(template)} ${location}`).join("\n"));
}
if (missing.length) process.exitCode = 1;
if (process.argv.includes("--check")) {
  import("../src/i18n/errorMessages.js").then(({ translateErrorMessage }) => {
    const uncovered = [];
    for (const [template, location] of templates) {
      if (template === "Row {}: {}") continue; // The nested error is translated separately at runtime.
      const sample = template.replaceAll("{}", "2");
      for (const lang of ["fr", "ar"]) {
        const output = translateErrorMessage(sample, lang);
        if ((output === sample && !(lang === "fr" && /[\u00c0-\u024f]/.test(sample)))
          || output.startsWith("Détail de l’erreur :") || output.startsWith("تفاصيل الخطأ:")) {
          uncovered.push(`${lang} ${JSON.stringify(template)} ${location}`);
        }
      }
    }
    console.log(`Dynamic error templates checked: ${templates.size}; untranslated: ${uncovered.length}`);
    if (uncovered.length) { console.log(uncovered.join("\n")); process.exitCode = 1; }
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
