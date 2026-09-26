#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const Database = require(path.join(projectRoot, "server", "node_modules", "better-sqlite3"));

const ENTITY_FILES = {
  categories: "categories.txt",
  customers: "clients.txt",
  suppliers: "suppliers.txt",
  products: "products.txt",
};

function usage() {
  console.log(`
Import des anciennes donnees SQL vers la base SQLite de POS Modern.

Simulation (aucune ecriture) :
  node migrate/import-to-sqlite.js --db "C:\\chemin\\pos-modern.sqlite" --warehouse 1

Import reel (une sauvegarde est creee automatiquement) :
  node migrate/import-to-sqlite.js --db "C:\\chemin\\pos-modern.sqlite" --warehouse 1 --apply

Options :
  --db <fichier>             Base SQLite cible (obligatoire)
  --warehouse <id|nom>       Entrepot recevant le stock initial des produits
  --source-dir <dossier>     Dossier des .txt (par defaut : migrate)
  --only <liste>             categories,customers,suppliers,products
  --update                   Met a jour les fiches deja liees (jamais leur stock)
  --apply                    Confirme l'import; sans cette option, simulation + rollback
  --help                     Affiche cette aide

Fermez POS Modern avant un import reel. Le script ne supprime aucune donnee.
`);
}

function parseArgs(argv) {
  const options = {
    apply: false,
    update: false,
    sourceDir: __dirname,
    only: Object.keys(ENTITY_FILES),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--update") options.update = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (["--db", "--warehouse", "--source-dir", "--only"].includes(argument)) {
      const value = argv[++index];
      if (!value) throw new Error(`Valeur manquante pour ${argument}`);
      if (argument === "--db") options.dbPath = path.resolve(value);
      if (argument === "--warehouse") options.warehouse = value;
      if (argument === "--source-dir") options.sourceDir = path.resolve(value);
      if (argument === "--only") options.only = value.split(",").map((item) => item.trim()).filter(Boolean);
    } else {
      throw new Error(`Option inconnue : ${argument}`);
    }
  }
  const invalid = options.only.filter((item) => !ENTITY_FILES[item]);
  if (invalid.length) throw new Error(`Types inconnus dans --only : ${invalid.join(", ")}`);
  return options;
}

function decodeSqlString(token) {
  let value = token.trim();
  if (/^NULL$/i.test(value)) return null;
  if (!(value.startsWith("'") && value.endsWith("'"))) return value;
  value = value.slice(1, -1);
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "'" && value[index + 1] === "'") {
      result += "'";
      index += 1;
    } else if (character === "\\" && index + 1 < value.length) {
      const next = value[++index];
      result += ({ n: "\n", r: "\r", t: "\t", "0": "\0" })[next] ?? next;
    } else {
      result += character;
    }
  }
  return result;
}

function parseSqlTuples(content) {
  const rows = [];
  let row = [];
  let token = "";
  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (depth === 0) {
      if (character === "(") {
        depth = 1;
        row = [];
        token = "";
      }
      continue;
    }
    if (quoted) {
      token += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "'") {
        if (content[index + 1] === "'") token += content[++index];
        else quoted = false;
      }
      continue;
    }
    if (character === "'") {
      quoted = true;
      token += character;
    } else if (character === "(") {
      depth += 1;
      token += character;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        row.push(decodeSqlString(token));
        rows.push(row);
        row = [];
        token = "";
      } else token += character;
    } else if (character === "," && depth === 1) {
      row.push(decodeSqlString(token));
      token = "";
    } else {
      token += character;
    }
  }
  if (quoted || depth !== 0) throw new Error("Le fichier SQL contient une ligne ou une chaine non fermee.");
  return rows;
}

function repairMojibake(value) {
  if (!value || !/[ÃÂ]/.test(value)) return value;
  const repaired = Buffer.from(value, "latin1").toString("utf8");
  const score = (text) => (text.match(/[ÃÂ�]/g) || []).length;
  return score(repaired) < score(value) ? repaired : value;
}

function textValue(value) {
  if (value == null) return null;
  const cleaned = repairMojibake(String(value)).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function numberValue(value) {
  if (value == null || value === "") return 0;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value) {
  const date = textValue(value);
  return date && /^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/.test(date) ? date : null;
}

function readLegacyData(sourceDir, only) {
  const data = {};
  for (const entity of only) {
    const filename = path.join(sourceDir, ENTITY_FILES[entity]);
    if (!fs.existsSync(filename)) throw new Error(`Fichier introuvable : ${filename}`);
    data[entity] = parseSqlTuples(fs.readFileSync(filename, "utf8"));
  }
  return data;
}

function assertSchema(db) {
  const required = ["users", "warehouses", "categories", "units", "products", "product_units", "product_barcodes", "product_stock", "stock_movements", "customers", "suppliers"];
  const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`Base POS Modern incompatible. Tables absentes : ${missing.join(", ")}`);
}

function resolveRecord(db, table, value, label) {
  const rows = value == null
    ? db.prepare(`SELECT id, name FROM ${table} WHERE is_active=1 ORDER BY id`).all()
    : /^\d+$/.test(String(value))
      ? db.prepare(`SELECT id, name FROM ${table} WHERE id=? AND is_active=1`).all(Number(value))
      : db.prepare(`SELECT id, name FROM ${table} WHERE name=? COLLATE NOCASE AND is_active=1`).all(value);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new Error(`${label} introuvable${value == null ? "" : ` : ${value}`}.`);
  throw new Error(`Plusieurs ${label.toLowerCase()}s sont disponibles; precisez --${label === "Entrepot" ? "warehouse" : "user"}.`);
}

function createStats() {
  return { inserted: 0, updated: 0, reused: 0, skipped: 0, warnings: [] };
}

function runImport(db, legacy, options, context) {
  db.exec(`CREATE TABLE IF NOT EXISTS legacy_import_map (
    source TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    legacy_id TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(source, entity_type, legacy_id)
  )`);
  const source = "legacy-mongodb-sql-files";
  const stats = {};
  const findMap = db.prepare("SELECT target_id FROM legacy_import_map WHERE source=? AND entity_type=? AND legacy_id=?");
  const saveMap = db.prepare("INSERT OR REPLACE INTO legacy_import_map(source,entity_type,legacy_id,target_id) VALUES(?,?,?,?)");
  const tableByEntity = { category: "categories", customer: "customers", supplier: "suppliers", product: "products" };
  const mappedTarget = (entity, legacyId) => {
    const map = findMap.get(source, entity, String(legacyId));
    if (!map) return null;
    return db.prepare(`SELECT id FROM ${tableByEntity[entity]} WHERE id=?`).get(map.target_id)?.id || null;
  };

  if (legacy.categories) {
    const current = stats.categories = createStats();
    const findByName = db.prepare("SELECT id FROM categories WHERE name=? COLLATE NOCASE");
    const insert = db.prepare("INSERT INTO categories(name,is_active) VALUES(?,1)");
    const update = db.prepare("UPDATE categories SET name=?,is_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?");
    for (const row of legacy.categories) {
      const legacyId = numberValue(row[0]);
      const name = textValue(row[1]);
      if (!legacyId || !name) { current.skipped += 1; current.warnings.push(`Categorie ignoree (id=${row[0] ?? "?"}, nom vide).`); continue; }
      let targetId = mappedTarget("category", legacyId);
      if (targetId) {
        if (options.update) { update.run(name, targetId); current.updated += 1; } else current.skipped += 1;
      } else {
        const existing = findByName.get(name);
        if (existing) { targetId = existing.id; current.reused += 1; }
        else { targetId = Number(insert.run(name).lastInsertRowid); current.inserted += 1; }
        saveMap.run(source, "category", String(legacyId), targetId);
      }
    }
  }

  const importPartners = (entityName, rows, definition) => {
    const current = stats[entityName] = createStats();
    const singular = definition.singular;
    const table = definition.table;
    const insert = db.prepare(`INSERT INTO ${table}(name,phone,email,nif,nis,tax_article,commercial_register,address,opening_balance,is_active,created_at)
      VALUES(@name,@phone,@email,@nif,@nis,@tax_article,@commercial_register,@address,@opening_balance,1,COALESCE(@created_at,CURRENT_TIMESTAMP))`);
    const update = db.prepare(`UPDATE ${table} SET name=@name,phone=@phone,email=@email,nif=@nif,nis=@nis,tax_article=@tax_article,
      commercial_register=@commercial_register,address=@address,opening_balance=@opening_balance,is_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
    for (const row of rows) {
      const legacyId = numberValue(row[0]);
      const record = definition.map(row);
      if (!legacyId || !record.name) { current.skipped += 1; current.warnings.push(`${singular} ignore (id=${row[0] ?? "?"}, nom vide).`); continue; }
      let targetId = mappedTarget(singular, legacyId);
      if (targetId) {
        if (options.update) { update.run({ ...record, id: targetId }); current.updated += 1; } else current.skipped += 1;
      } else {
        targetId = Number(insert.run(record).lastInsertRowid);
        saveMap.run(source, singular, String(legacyId), targetId);
        current.inserted += 1;
      }
    }
  };

  if (legacy.customers) importPartners("customers", legacy.customers, {
    singular: "customer", table: "customers", map: (row) => ({
      name: textValue(row[1]), address: textValue(row[3]), phone: textValue(row[4]), email: textValue(row[6]),
      commercial_register: textValue(row[7]), nif: textValue(row[8]), tax_article: textValue(row[9]),
      opening_balance: numberValue(row[10]), nis: textValue(row[13]), created_at: dateValue(row[12]),
    }),
  });
  if (legacy.suppliers) importPartners("suppliers", legacy.suppliers, {
    singular: "supplier", table: "suppliers", map: (row) => ({
      name: textValue(row[1]), address: textValue(row[2]), email: textValue(row[4]), phone: textValue(row[5]),
      opening_balance: numberValue(row[6]), created_at: dateValue(row[8]), nif: null, nis: null,
      tax_article: null, commercial_register: null,
    }),
  });

  if (legacy.products) {
    const current = stats.products = createStats();
    const unit = db.prepare("SELECT id FROM units WHERE is_builtin=1 AND is_active=1 ORDER BY id LIMIT 1").get();
    if (!unit) throw new Error("Unite generique integree introuvable.");
    const categoryMap = (legacyId) => legacyId ? mappedTarget("category", legacyId) : null;
    const findCode = db.prepare(`SELECT p.id,p.designation FROM products p WHERE p.reference=? COLLATE NOCASE
      UNION SELECT p.id,p.designation FROM product_barcodes b JOIN products p ON p.id=b.product_id WHERE b.barcode=? COLLATE NOCASE LIMIT 1`);
    const referenceExists = db.prepare("SELECT 1 FROM products WHERE reference=? COLLATE NOCASE");
    const insertProduct = db.prepare(`INSERT INTO products(designation,reference,category_id,unit_id,purchase_price,selling_price,min_stock,track_stock,is_active)
      VALUES(@designation,@reference,@category_id,@unit_id,@purchase_price,@selling_price,0,1,1)`);
    const updateProduct = db.prepare(`UPDATE products SET designation=@designation,category_id=@category_id,unit_id=@unit_id,
      purchase_price=@purchase_price,selling_price=@selling_price,is_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
    const insertUnit = db.prepare("INSERT INTO product_units(product_id,unit_id,conversion_factor,purchase_price,selling_price,is_base,is_active) VALUES(?,?,1,?,?,1,1)");
    const updateUnit = db.prepare("UPDATE product_units SET purchase_price=?,selling_price=?,is_active=1 WHERE product_id=? AND is_base=1");
    const insertBarcode = db.prepare("INSERT INTO product_barcodes(product_id,product_unit_id,barcode,is_primary) VALUES(?,?,?,1)");
    const insertStock = db.prepare("INSERT INTO product_stock(product_id,warehouse_id,quantity) VALUES(?,?,?)");
    for (const row of legacy.products) {
      const legacyId = numberValue(row[0]);
      const designation = textValue(row[1]);
      if (!legacyId || !designation) { current.skipped += 1; current.warnings.push(`Produit ignore (id=${row[0] ?? "?"}, designation vide).`); continue; }
      const purchasePrice = Math.max(0, numberValue(row[2]));
      const sellingPrice = Math.max(0, numberValue(row[9]));
      // Legacy quantities are intentionally ignored. Imported products always
      // start at zero so their real stock can be entered through POS Modern.
      const quantity = 0;
      const code = textValue(row[4]);
      const productRecord = { designation, category_id: categoryMap(numberValue(row[8])), unit_id: unit.id, purchase_price: purchasePrice, selling_price: sellingPrice };
      let targetId = mappedTarget("product", legacyId);
      if (targetId) {
        if (options.update) {
          updateProduct.run({ ...productRecord, id: targetId });
          updateUnit.run(purchasePrice, sellingPrice, targetId);
          current.updated += 1;
        } else current.skipped += 1;
        continue;
      }

      const collision = code ? findCode.get(code, code) : null;
      if (collision && collision.designation.localeCompare(designation, undefined, { sensitivity: "base" }) === 0) {
        targetId = collision.id;
        saveMap.run(source, "product", String(legacyId), targetId);
        current.reused += 1;
        continue;
      }
      let reference = code;
      let barcode = code;
      if (!reference || collision) {
        reference = `LEGACY-${legacyId}`;
        let suffix = 2;
        while (referenceExists.get(reference)) reference = `LEGACY-${legacyId}-${suffix++}`;
        if (collision) {
          barcode = null;
          current.warnings.push(`Code ${code} deja utilise; ${designation} importe avec la reference ${reference}, sans code-barres duplique.`);
        }
      }
      targetId = Number(insertProduct.run({ ...productRecord, reference }).lastInsertRowid);
      const productUnitId = Number(insertUnit.run(targetId, unit.id, purchasePrice, sellingPrice).lastInsertRowid);
      if (barcode) insertBarcode.run(targetId, productUnitId, barcode);
      insertStock.run(targetId, context.warehouse.id, quantity);
      saveMap.run(source, "product", String(legacyId), targetId);
      current.inserted += 1;
    }
  }
  return stats;
}

function backupDatabase(db, dbPath) {
  db.pragma("wal_checkpoint(TRUNCATE)");
  const backupDir = path.join(path.dirname(dbPath), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = path.extname(dbPath) || ".sqlite";
  const filename = `${path.basename(dbPath, extension)}-before-legacy-import-${stamp}${extension}`;
  const destination = path.join(backupDir, filename);
  fs.copyFileSync(dbPath, destination);
  return destination;
}

function printStats(stats) {
  console.log("\nResultat :");
  for (const [entity, value] of Object.entries(stats)) {
    console.log(`- ${entity}: ${value.inserted} ajoutes, ${value.updated} modifies, ${value.reused} reutilises, ${value.skipped} ignores`);
  }
  const warnings = Object.values(stats).flatMap((value) => value.warnings);
  if (warnings.length) {
    console.log(`\nAvertissements (${warnings.length}) :`);
    warnings.slice(0, 30).forEach((warning) => console.log(`- ${warning}`));
    if (warnings.length > 30) console.log(`- ... ${warnings.length - 30} autres avertissements`);
  }
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) { usage(); return; }
  if (!options.dbPath) throw new Error("--db est obligatoire. Utilisez --help pour voir un exemple.");
  if (!fs.existsSync(options.dbPath)) throw new Error(`Base SQLite introuvable : ${options.dbPath}`);
  const legacy = readLegacyData(options.sourceDir, options.only);
  console.log("Fichiers lus :", Object.entries(legacy).map(([name, rows]) => `${name}=${rows.length}`).join(", "));

  let db = new Database(options.dbPath);
  db.pragma("foreign_keys=ON");
  db.pragma("busy_timeout=5000");
  try {
    assertSchema(db);
    const needsProducts = Boolean(legacy.products);
    const context = {
      warehouse: needsProducts ? resolveRecord(db, "warehouses", options.warehouse, "Entrepot") : null,
    };
    if (needsProducts) console.log(`Entrepot cible : ${context.warehouse.name} (#${context.warehouse.id}); stock importe : 0`);
    if (options.apply) console.log(`Sauvegarde : ${backupDatabase(db, options.dbPath)}`);
    db.exec("BEGIN IMMEDIATE");
    try {
      const stats = runImport(db, legacy, options, context);
      if (options.apply) db.exec("COMMIT");
      else db.exec("ROLLBACK");
      printStats(stats);
      console.log(options.apply ? "\nImport termine." : "\nSIMULATION TERMINEE : aucune donnee n'a ete modifiee. Relancez avec --apply pour importer.");
    } catch (error) {
      if (db.inTransaction) db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(`\nErreur d'import : ${error.message}`); process.exitCode = 1; }
}

module.exports = { parseSqlTuples, decodeSqlString, readLegacyData, runImport, main };
