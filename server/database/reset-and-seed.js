/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { hashPassword } = require("../utils/password");

const databasePath = path.resolve(process.env.POS_TEST_DB_PATH || path.join(__dirname, "../config/pos-modern.db"));
const backupDirectory = path.resolve(process.env.POS_TEST_BACKUP_DIR || path.join(__dirname, "../backups"));
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");

function backupAndRemoveDatabase() {
  fs.mkdirSync(backupDirectory, { recursive: true });
  if (fs.existsSync(databasePath)) {
    const connection = new Database(databasePath);
    connection.pragma("wal_checkpoint(TRUNCATE)");
    const integrity = connection.pragma("integrity_check", { simple: true });
    connection.close();
    if (integrity !== "ok") throw new Error(`The existing database is not healthy: ${integrity}`);
    fs.copyFileSync(databasePath, path.join(backupDirectory, `before-development-reset-${timestamp}.sqlite`));
  }
  for (const target of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`])
    if (fs.existsSync(target)) fs.rmSync(target);
}

function dateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function seed() {
  require("./migrations/init");
  const db = require("../config/database");
  const Product = require("../models/product.model");
  const Pos = require("../services/pos.service");
  const Commercial = require("../services/commercial.service");
  const Invoice = require("../services/invoice.service");
  const Purchases = require("../services/purchase.service");
  const Settings = require("../services/settings.service");

  const insertWarehouse = db.prepare(
    `INSERT INTO warehouses(name,phone,email,nif,address,business_activity,can_sell,is_active)
     VALUES(?,?,?,?,?,?,1,1)`,
  );
  const warehouseNorth = Number(insertWarehouse.run(
    "MODERNA Démo Centre", "+213 555 010 100", "centre@moderna-demo.example",
    "000000000000001", "12 rue des Ateliers, Alger", "Commerce de matériel informatique",
  ).lastInsertRowid);
  const warehouseWest = Number(insertWarehouse.run(
    "MODERNA Démo Ouest", "+213 555 010 200", "ouest@moderna-demo.example",
    "000000000000002", "8 zone d'activité, Oran", "Distribution informatique",
  ).lastInsertRowid);

  const insertRegister = db.prepare(
    "INSERT INTO cash_registers(warehouse_id,name,code,is_active) VALUES(?,?,?,1)",
  );
  const registerNorth = Number(insertRegister.run(warehouseNorth, "Caisse principale", "DEMO-CENTRE-01").lastInsertRowid);
  insertRegister.run(warehouseNorth, "Caisse secondaire", "DEMO-CENTRE-02");
  const registerWest = Number(insertRegister.run(warehouseWest, "Caisse Ouest", "DEMO-OUEST-01").lastInsertRowid);

  const insertUser = db.prepare(
    "INSERT INTO users(name,username,password_hash,role,warehouse_id,is_active) VALUES(?,?,?,?,?,1)",
  );
  const adminId = Number(insertUser.run("Administrateur Démo", "admin", hashPassword("Admin123!"), "admin", warehouseNorth).lastInsertRowid);
  const managerId = Number(insertUser.run("Responsable Ouest", "manager.ouest", hashPassword("Manager123!"), "manager", warehouseWest).lastInsertRowid);
  const cashierId = Number(insertUser.run("Vendeur Démo", "vendeur", hashPassword("Vendeur123!"), "cashier", warehouseNorth).lastInsertRowid);
  const linkWarehouse = db.prepare("INSERT INTO user_warehouses(user_id,warehouse_id) VALUES(?,?)");
  linkWarehouse.run(adminId, warehouseNorth);
  linkWarehouse.run(adminId, warehouseWest);
  linkWarehouse.run(managerId, warehouseWest);
  linkWarehouse.run(cashierId, warehouseNorth);
  const admin = { id: adminId, role: "admin", warehouse_id: warehouseNorth, warehouse_ids: [warehouseNorth, warehouseWest] };
  const manager = { id: managerId, role: "manager", warehouse_id: warehouseWest, warehouse_ids: [warehouseWest] };

  db.prepare("INSERT INTO cash_sessions(cash_register_id,user_id,opening_cash,status) VALUES(?,?,50000,'open')").run(registerNorth, adminId);
  db.prepare("INSERT INTO cash_sessions(cash_register_id,user_id,opening_cash,status) VALUES(?,?,25000,'open')").run(registerWest, managerId);

  const unitId = Number(db.prepare("SELECT id FROM units WHERE is_builtin=1").get().id);
  const cartonId = Number(db.prepare("INSERT INTO units(name,symbol,is_builtin,is_active) VALUES('Carton','ct',0,1)").run().lastInsertRowid);
  const categories = {};
  for (const name of ["Ordinateurs", "Téléphonie", "Périphériques", "Stockage", "Consommables"])
    categories[name] = Number(db.prepare("INSERT INTO categories(name,is_active) VALUES(?,1)").run(name).lastInsertRowid);

  const insertCustomer = db.prepare(
    `INSERT INTO customers(name,phone,email,nif,address,business_activity,opening_balance,is_active)
     VALUES(?,?,?,?,?,?,0,1)`,
  );
  const customers = {
    counter: Number(insertCustomer.run("Client comptoir Démo", "+213 555 100 001", null, null, "Alger", "Particulier").lastInsertRowid),
    atlas: Number(insertCustomer.run("SARL Atlas Numérique", "+213 555 100 002", "contact@atlas-demo.example", "100000000000001", "Bab Ezzouar, Alger", "Services numériques").lastInsertRowid),
    nova: Number(insertCustomer.run("EURL Nova Bureau", "+213 555 100 003", "achats@nova-demo.example", "100000000000002", "Bir El Djir, Oran", "Fournitures de bureau").lastInsertRowid),
    horizon: Number(insertCustomer.run("Horizon Éducation", "+213 555 100 004", "admin@horizon-demo.example", "100000000000003", "Tlemcen", "Formation").lastInsertRowid),
  };
  const insertSupplier = db.prepare(
    `INSERT INTO suppliers(name,phone,email,nif,address,business_activity,opening_balance,is_active)
     VALUES(?,?,?,?,?,?,0,1)`,
  );
  const suppliers = {
    maghreb: Number(insertSupplier.run("Maghreb Tech Distribution", "+213 555 200 001", "commandes@maghreb-tech-demo.example", "200000000000001", "Rouiba, Alger", "Grossiste informatique").lastInsertRowid),
    pixel: Number(insertSupplier.run("Pixel Import Démo", "+213 555 200 002", "ventes@pixel-import-demo.example", "200000000000002", "Es Sénia, Oran", "Importateur électronique").lastInsertRowid),
    office: Number(insertSupplier.run("Office Supply Démo", "+213 555 200 003", "contact@office-supply-demo.example", "200000000000003", "Sétif", "Consommables").lastInsertRowid),
  };

  function createProduct({ designation, reference, category, purchase, selling, min = 0, serial = false, batch = false, expiration = false, stocks = [], carton = null }) {
    return Product.create({
      designation,
      reference,
      image_data: null,
      category_id: categories[category],
      min_stock: min,
      track_stock: true,
      track_batches: batch,
      track_expiration: expiration,
      track_serials: serial,
      description: `Donnée fictive de démonstration — ${designation}`,
      is_active: true,
      product_units: [
        { unit_id: unitId, conversion_factor: 1, purchase_price: purchase, selling_price: selling, is_base: true, is_active: true, barcodes: [{ barcode: reference.replaceAll("-", "") + "01", is_primary: true }] },
        ...(carton ? [{ unit_id: cartonId, conversion_factor: carton.quantity, purchase_price: carton.quantity * purchase, selling_price: carton.quantity * selling, is_base: false, is_active: true, barcodes: [] }] : []),
      ],
      initial_stock: stocks.map((stock) => ({
        warehouse_id: stock.warehouse_id,
        product_unit_index: 0,
        quantity: stock.quantity,
        batch_number: stock.batch_number || null,
        expiration_date: stock.expiration_date || null,
        purchase_price: purchase,
        serial_numbers: stock.serial_numbers || [],
      })),
      created_by: adminId,
    });
  }

  const products = {
    laptop: createProduct({ designation: "Laptop Pro 14 Démo", reference: "DEMO-LAP-14", category: "Ordinateurs", purchase: 82000, selling: 109000, min: 2, stocks: [{ warehouse_id: warehouseNorth, quantity: 2 }, { warehouse_id: warehouseWest, quantity: 4 }] }),
    phone: createProduct({ designation: "Smartphone X128 Démo", reference: "DEMO-PHN-X128", category: "Téléphonie", purchase: 54000, selling: 69900, min: 2, serial: true, stocks: [{ warehouse_id: warehouseNorth, quantity: 5, serial_numbers: ["DEMO-X128-0001", "DEMO-X128-0002", "DEMO-X128-0003", "DEMO-X128-0004", "DEMO-X128-0005"] }, { warehouse_id: warehouseWest, quantity: 3, serial_numbers: ["DEMO-X128-1001", "DEMO-X128-1002", "DEMO-X128-1003"] }] }),
    mouse: createProduct({ designation: "Souris sans fil Démo", reference: "DEMO-MSE-01", category: "Périphériques", purchase: 1800, selling: 2900, min: 5, stocks: [{ warehouse_id: warehouseNorth, quantity: 3 }, { warehouse_id: warehouseWest, quantity: 9 }], carton: { quantity: 10 } }),
    ssd: createProduct({ designation: "SSD 1 To Démo", reference: "DEMO-SSD-1T", category: "Stockage", purchase: 7200, selling: 9900, min: 4, batch: true, expiration: true, stocks: [{ warehouse_id: warehouseNorth, quantity: 12, batch_number: "LOT-SSD-A", expiration_date: dateOffset(20) }, { warehouse_id: warehouseWest, quantity: 8, batch_number: "LOT-SSD-B", expiration_date: dateOffset(180) }] }),
    keyboard: createProduct({ designation: "Clavier mécanique Démo", reference: "DEMO-KBD-01", category: "Périphériques", purchase: 4200, selling: 6500, min: 3, stocks: [{ warehouse_id: warehouseNorth, quantity: 10 }, { warehouse_id: warehouseWest, quantity: 5 }] }),
    monitor: createProduct({ designation: "Écran 24 pouces Démo", reference: "DEMO-MON-24", category: "Périphériques", purchase: 19500, selling: 26900, min: 2, stocks: [] }),
  };
  const catalogue = [
    ["Ordinateur portable", "Ordinateurs", 68000],
    ["Mini PC", "Ordinateurs", 42000],
    ["Smartphone", "Téléphonie", 36000],
    ["Tablette", "Téléphonie", 29000],
    ["Écran IPS", "Périphériques", 17000],
    ["Clavier USB", "Périphériques", 2200],
    ["Souris optique", "Périphériques", 1300],
    ["Disque SSD", "Stockage", 5800],
    ["Clé USB", "Stockage", 1200],
    ["Cartouche d’encre", "Consommables", 3100],
  ];
  const extraProducts = [];
  for (let index = 1; index <= 194; index += 1) {
    const [name, category, basePrice] = catalogue[(index - 1) % catalogue.length];
    const purchase = basePrice + (index % 7) * 250;
    extraProducts.push(createProduct({
      designation: `${name} Série ${String(index).padStart(3, "0")} Démo`,
      reference: `DEMO-SKU-${String(index).padStart(3, "0")}`,
      category,
      purchase,
      selling: Math.round(purchase * 1.28),
      min: 3,
      stocks: [
        { warehouse_id: warehouseNorth, quantity: 12 + index % 8 },
        { warehouse_id: warehouseWest, quantity: 8 + index % 6 },
      ],
    }));
  }
  const baseUnit = (product) => product.product_units.find((row) => row.is_base);
  const line = (product, quantity, discount = 0, extra = {}) => ({
    line_type: "PRODUCT", product_id: product.id, product_unit_id: baseUnit(product).id,
    quantity, unit_price: Number(baseUnit(product).selling_price), discount_percent: discount, ...extra,
  });

  Settings.updateGroup("sales", { ...Settings.getGroup("sales"), allow_default_customer: true, default_customer_id: customers.counter, allow_discount: true, max_discount_percent: 25 }, admin);
  Settings.updateGroup("general", { ...Settings.getGroup("general"), application_name: "POS Modern — Démonstration", default_warehouse_id: warehouseNorth, default_cash_register_id: registerNorth, product_images_enabled: true }, admin);

  const paidSale = Pos.finalize({ client_request_id: "seed-sale-paid", warehouse_id: warehouseNorth, customer_id: customers.atlas, sale_date: dateOffset(0), document_type: "BON_POUR", lines: [line(products.laptop, 1), line(products.mouse, 2)], payments: [{ code: "CASH", amount: 114800 }] }, admin);
  const partialSale = Pos.finalize({ client_request_id: "seed-sale-partial", warehouse_id: warehouseNorth, customer_id: customers.nova, sale_date: dateOffset(-2), document_type: "TICKET", lines: [line(products.keyboard, 2)], payments: [{ code: "CARD", amount: 5000 }], leave_unpaid: true }, admin);
  const unpaidSale = Pos.finalize({ client_request_id: "seed-sale-unpaid", warehouse_id: warehouseNorth, customer_id: customers.horizon, sale_date: dateOffset(-3), document_type: "BON_POUR", lines: [line(products.ssd, 2, 5, { batch_id: db.prepare("SELECT id FROM stock_batches WHERE product_id=? AND warehouse_id=? ORDER BY id LIMIT 1").get(products.ssd.id, warehouseNorth).id })], payments: [], leave_unpaid: true }, admin);
  const serialId = db.prepare("SELECT id FROM stock_serials WHERE product_id=? AND warehouse_id=? AND status='AVAILABLE' ORDER BY id LIMIT 1").get(products.phone.id, warehouseNorth).id;
  const serialSale = Pos.finalize({ client_request_id: "seed-sale-serial", warehouse_id: warehouseNorth, customer_id: customers.atlas, sale_date: dateOffset(-4), document_type: "TICKET", lines: [line(products.phone, 1, 0, { serial_ids: [serialId] })], payments: [{ code: "BANK_TRANSFER", amount: 69900 }] }, admin);
  Pos.finalize({ client_request_id: "seed-sale-west", warehouse_id: warehouseWest, customer_id: customers.nova, sale_date: dateOffset(-5), document_type: "TICKET", lines: [line(products.mouse, 2)], payments: [{ code: "CASH", amount: 5800 }] }, manager);

  Commercial.saveQuote({ client_request_id: "seed-quote-1", warehouse_id: warehouseNorth, customer_id: customers.horizon, quote_date: dateOffset(-1), valid_until: dateOffset(14), lines: [line(products.laptop, 2), line(products.keyboard, 3)], global_discount_type: "PERCENT", global_discount_value: 5, note: "Proposition commerciale fictive" }, admin);
  const salesInvoice = Invoice.createForSales([partialSale.id], { client_request_id: "seed-customer-invoice", invoice_date: dateOffset(-1), due_date: dateOffset(29), tax_enabled: true, tax_rate: 19, stamp_enabled: false }, admin);
  Invoice.addPayment(salesInvoice.id, { client_request_id: "seed-invoice-payment", payment_method_code: "BANK_TRANSFER", amount: 3000 }, admin);
  Commercial.createReturn(paidSale.id, { client_request_id: "seed-sales-return", return_date: dateOffset(0), settlement_mode: "REFUND", refund_payment_method_code: "CASH", lines: [{ sale_line_id: paidSale.lines.find((row) => row.product_id === products.mouse.id).id, quantity: 1 }] }, admin);

  const purchaseLine = (product, quantity, price = null) => ({ product_id: product.id, product_unit_id: baseUnit(product).id, quantity, unit_price: price ?? Number(baseUnit(product).purchase_price) });
  const orderUnreceived = Purchases.createOrder({ client_request_id: "seed-po-unreceived", warehouse_id: warehouseNorth, supplier_id: suppliers.maghreb, order_date: dateOffset(-4), lines: [purchaseLine(products.monitor, 6)] }, admin);
  const orderPartial = Purchases.createOrder({ client_request_id: "seed-po-partial", warehouse_id: warehouseNorth, supplier_id: suppliers.pixel, order_date: dateOffset(-5), lines: [purchaseLine(products.phone, 5)] }, admin);
  const partialReceipt = Purchases.createReceipt({ client_request_id: "seed-receipt-partial", purchase_order_id: orderPartial.id, warehouse_id: warehouseNorth, supplier_id: suppliers.pixel, receipt_date: dateOffset(-3), lines: [{ purchase_order_line_id: orderPartial.lines[0].id, quantity: 2, unit_price: 54000, serial_numbers: ["DEMO-X128-NEW-01", "DEMO-X128-NEW-02"] }] }, admin);
  const orderComplete = Purchases.createOrder({ client_request_id: "seed-po-complete", warehouse_id: warehouseWest, supplier_id: suppliers.office, order_date: dateOffset(-7), lines: [purchaseLine(products.keyboard, 8)] }, manager);
  const completeReceipt = Purchases.createReceipt({ client_request_id: "seed-receipt-complete", purchase_order_id: orderComplete.id, warehouse_id: warehouseWest, supplier_id: suppliers.office, receipt_date: dateOffset(-6), lines: [{ purchase_order_line_id: orderComplete.lines[0].id, quantity: 8, unit_price: 4200 }] }, manager);
  const directReceipt = Purchases.createReceipt({ client_request_id: "seed-receipt-direct", warehouse_id: warehouseNorth, supplier_id: suppliers.maghreb, receipt_date: dateOffset(-2), lines: [purchaseLine(products.mouse, 10, 1750)] }, admin);

  Purchases.addReceiptPayment(completeReceipt.id, { client_request_id: "seed-supplier-pay-partial", payment_method_code: "BANK_TRANSFER", amount: 12000, payment_date: dateOffset(-2) }, manager);
  Purchases.addReceiptPayment(directReceipt.id, { client_request_id: "seed-supplier-pay-paid", payment_method_code: "CASH", amount: 17500, payment_date: dateOffset(0) }, admin);
  Purchases.createReturn(directReceipt.id, { client_request_id: "seed-supplier-return", return_date: dateOffset(0), settlement_mode: "REFUND", refund_payment_method_code: "CASH", lines: [{ purchase_receipt_line_id: directReceipt.lines[0].id, quantity: 1 }] }, admin);

  // A broad but deterministic catalogue of dated documents, created through
  // the same business services as the UI (including their stock and ledgers).
  const paymentMethods = ["CASH", "CARD", "BANK_TRANSFER", "CHEQUE"];
  for (let index = 0; index < 32; index += 1) {
    const product = extraProducts[index];
    const warehouseId = index % 2 ? warehouseWest : warehouseNorth;
    const actor = index % 2 ? manager : admin;
    const supplierId = [suppliers.maghreb, suppliers.pixel, suppliers.office][index % 3];
    const receiptDate = dateOffset(-58 + index);
    const item = purchaseLine(product, 3 + index % 4);
    let order = null;
    if (index % 3 !== 0)
      order = Purchases.createOrder({ client_request_id: `demo-order-${index}`, warehouse_id: warehouseId, supplier_id: supplierId, order_date: dateOffset(-60 + index), lines: [item] }, actor);
    const receipt = Purchases.createReceipt({
      client_request_id: `demo-receipt-${index}`, purchase_order_id: order?.id,
      warehouse_id: warehouseId, supplier_id: supplierId, receipt_date: receiptDate,
      lines: [{ ...item, ...(order ? { purchase_order_line_id: order.lines[0].id } : {}) }],
    }, actor);
    if (index % 3 !== 0) {
      const amount = index % 3 === 1 ? Math.round(Number(receipt.total) * 0.4 * 100) / 100 : Number(receipt.total);
      Purchases.addReceiptPayment(receipt.id, {
        client_request_id: `demo-supplier-payment-${index}`,
        payment_method_code: paymentMethods[index % paymentMethods.length],
        amount, payment_date: dateOffset(-40 + index),
      }, actor);
    }
  }

  const customerIds = [customers.counter, customers.atlas, customers.nova, customers.horizon];
  for (let index = 0; index < 48; index += 1) {
    const product = extraProducts[index + 40];
    const warehouseId = index % 2 ? warehouseWest : warehouseNorth;
    const actor = index % 2 ? manager : admin;
    const amount = Number(baseUnit(product).selling_price);
    const payment = index % 3 === 0 ? [] : [{
      code: paymentMethods[index % paymentMethods.length],
      amount: index % 3 === 1 ? Math.round(amount * 0.4) : amount,
    }];
    const sale = Pos.finalize({
      client_request_id: `demo-sale-${index}`, warehouse_id: warehouseId,
      customer_id: customerIds[index % customerIds.length],
      sale_date: dateOffset(-47 + index),
      document_type: index % 2 ? "TICKET" : "BON_POUR",
      lines: [line(product, 1)], payments: payment,
      leave_unpaid: index % 3 !== 2,
    }, actor);
    if (index % 4 === 0) {
      const invoice = Invoice.createForSales([sale.id], {
        client_request_id: `demo-invoice-${index}`,
        invoice_date: dateOffset(-45 + index), due_date: dateOffset(-15 + index),
        tax_enabled: index % 8 === 0, tax_rate: 19,
        stamp_enabled: index % 8 === 4, stamp_rate: 1,
      }, actor);
      if (index % 8 === 0 && Number(invoice.balance_due) >= 500)
        Invoice.addPayment(invoice.id, {
          client_request_id: `demo-invoice-payment-${index}`,
          payment_method_code: "BANK_TRANSFER", amount: 500,
        }, actor);
    }
  }

  // Keep explicit references so accidental seed changes are immediately visible.
  const checks = {
    warehouses: db.prepare("SELECT COUNT(*) count FROM warehouses").get().count,
    products: db.prepare("SELECT COUNT(*) count FROM products").get().count,
    sales: db.prepare("SELECT COUNT(*) count FROM sales WHERE sale_status='CONFIRMED'").get().count,
    purchase_receipts: db.prepare("SELECT COUNT(*) count FROM purchase_receipts").get().count,
    transactions: db.prepare("SELECT COUNT(*) count FROM financial_transactions").get().count,
  };
  if (checks.warehouses !== 2 || checks.products !== 200 || checks.sales < 50 || checks.purchase_receipts < 35 || checks.transactions < 50)
    throw new Error(`Seed verification failed: ${JSON.stringify(checks)}`);
  const integrity = db.pragma("integrity_check", { simple: true });
  const foreignKeys = db.pragma("foreign_key_check");
  if (integrity !== "ok" || foreignKeys.length) throw new Error(`Database verification failed: ${integrity}; FK=${JSON.stringify(foreignKeys)}`);
  db.pragma("wal_checkpoint(TRUNCATE)");
  console.log("Development database reset and seeded successfully.");
  console.log("Credentials: admin / Admin123! | manager.ouest / Manager123! | vendeur / Vendeur123!");
  console.log(checks);
  void orderUnreceived;
  void partialReceipt;
  void serialSale;
}

if (!process.argv.includes("--yes")) {
  console.error("This command replaces the database with fictional demo data. Run with --yes to confirm.");
  process.exit(1);
}
try {
  backupAndRemoveDatabase();
  seed();
} catch (error) {
  console.error("Development reset/seed failed:", error);
  process.exitCode = 1;
}
