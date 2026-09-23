const assert = require("node:assert/strict");
const db = require("../config/database");
require("../database/migrations/init");
const Settings = require("../services/settings.service");
const controller = require("../controllers/settings.controller");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

let complete = false;
try {
  db.transaction(() => {
    const admin = db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get();
    assert.ok(admin?.id, "A seeded user is required");
    const logoData = "data:image/png;base64,iVBORw0KGgo=";
    assert.equal(Settings.updateGroup("general", { logo_data: logoData }, admin).logo_data, logoData);
    assert.equal(Settings.profiles()[0].logo_data, logoData);
    assert.throws(() => Settings.updateGroup("general", { logo_data: "data:image/svg+xml;base64,PHN2Zz4=" }, admin), /Logo must/);
    assert.equal(Settings.updateGroup("general", { logo_data: null }, admin).logo_data, null);
    assert.equal(
      typeof Settings.getGroup("sales").allow_negative_stock,
      "boolean",
    );
    Settings.updateGroup("sales", { allow_negative_stock: false }, admin);
    assert.equal(Settings.getGroup("sales").allow_negative_stock, false);
    const customerId = Number(
      db
        .prepare(
          "INSERT INTO customers(name,is_active) VALUES('Settings customer',1)",
        )
        .run().lastInsertRowid,
    );
    let sales = Settings.updateGroup(
      "sales",
      { default_customer_id: customerId, max_discount_percent: 25 },
      admin,
    );
    assert.equal(sales.default_customer_id, customerId);
    assert.equal(sales.default_customer_valid, true);
    db.prepare("UPDATE customers SET is_active=0 WHERE id=?").run(customerId);
    assert.equal(Settings.getGroup("sales").default_customer_valid, false);
    assert.throws(
      () => Settings.updateGroup("sales", { max_discount_percent: 101 }, admin),
      /allowed range/,
    );
    assert.throws(
      () => Settings.updateGroup("sales", { unknown: true }, admin),
      /unsupported setting/,
    );

    Settings.setPaymentActive("CARD", false);
    assert.throws(
      () => Settings.updateGroup("payments", { default_method: "CARD" }, admin),
      /must be active/,
    );
    Settings.setPaymentActive("CARD", true);
    Settings.updateGroup("payments", { default_method: "CARD" }, admin);
    assert.throws(
      () => Settings.setPaymentActive("CARD", false),
      /default payment/,
    );

    const printer = Settings.savePrinter({
      name: "Test receipt",
      system_name: "test-printer",
      printer_type: "RECEIPT",
      workstation_id: "TEST-PC",
      is_active: true,
    }).find((item) => item.system_name === "test-printer");
    assert.ok(printer.id);
    const profile = Settings.saveProfile("SALE_TICKET", {
      printer_id: printer.id,
      paper_format: "THERMAL_80",
      copies: 2,
      auto_print: true,
      configuration: { show_logo: true, footer_message: "Thank you" },
    });
    assert.equal(profile.configuration.footer_message, "Thank you");
    const receiptProfile = Settings.saveProfile("PURCHASE_RECEIPT", {
      printer_id: null,
      paper_format: "A4",
      copies: 1,
      auto_print: false,
      configuration: {
        title: "BON DE RÉCEPTION",
        show_warehouse_name: true,
        show_address: true,
        show_phone: true,
        show_email: true,
        show_customer: true,
        show_discounts: false,
      },
    });
    assert.equal(receiptProfile.configuration.show_email, true);
    assert.equal(receiptProfile.configuration.show_discounts, false);
    for (const type of ["SALE_INVOICE", "SHIPPING_INVOICE", "INVOICE", "QUOTE", "SALES_RETURN", "PURCHASE_ORDER", "PURCHASE_RECEIPT", "PURCHASE_RETURN"]) {
      const current = Settings.profiles().find((item) => item.document_type === type);
      assert.ok(current, `${type} profile must exist`);
      const updated = Settings.saveProfile(type, {
        printer_id: current.printer_id,
        paper_format: current.paper_format,
        copies: current.copies,
        auto_print: Boolean(current.auto_print),
        configuration: { ...current.configuration, show_discounts: false },
      });
      assert.equal(updated.configuration.show_discounts, false);
    }
    assert.ok(Settings.profiles().some((item) => item.document_type === "PURCHASE_RETURN"));
    assert.throws(
      () =>
        Settings.saveProfile("BARCODE_LABEL", {
          printer_id: printer.id,
          paper_format: "50x30mm",
          copies: 1,
          configuration: { symbology: "CODE128" },
        }),
      /incompatible/,
    );
    const labelPrinter = Settings.savePrinter({
      name: "Test label",
      system_name: "test-label-printer",
      printer_type: "LABEL",
      workstation_id: "TEST-PC",
      is_active: true,
    }).find((item) => item.system_name === "test-label-printer");
    const labelProfile = Settings.saveProfile("BARCODE_LABEL", {
      printer_id: labelPrinter.id,
      paper_format: "CUSTOM",
      copies: 1,
      auto_print: true,
      configuration: {
        symbology: "CODE128",
        show_price: true,
        price_position: "BOTTOM",
        show_barcode_text: false,
        label_width_mm: 55,
        label_height_mm: 32,
        content_gap_mm: 2,
        label_padding_mm: 3,
      },
    });
    assert.equal(labelProfile.paper_format, "CUSTOM");
    assert.equal(labelProfile.configuration.price_position, "BOTTOM");
    assert.equal(labelProfile.configuration.show_barcode_text, false);
    assert.equal(labelProfile.configuration.content_gap_mm, 2);

    Settings.updateGroup(
      "numbering",
      { sale_prefix: "VNT", sale_include_year: true, sale_padding: 6 },
      admin,
    );
    const year = new Date().getFullYear();
    const currentSequence = Number(
      db
        .prepare(
          "SELECT current_value FROM document_sequences WHERE document_type='SALE'",
        )
        .get()?.current_value || 0,
    );
    const preview = `VNT-${year}-${String(currentSequence + 1).padStart(6, "0")}`;
    assert.equal(Settings.numberingPreview(), preview);
    assert.equal(Settings.numberingPreview(), preview);
    assert.equal(Settings.nextDocumentNumber(), preview);
    assert.equal(
      Settings.nextDocumentNumber(),
      `VNT-${year}-${String(currentSequence + 2).padStart(6, "0")}`,
    );

    const denied = response();
    controller.updateGroup(
      {
        params: { group: "sales" },
        body: {},
        user: { id: admin.id, role: "cashier" },
      },
      denied,
    );
    assert.equal(denied.statusCode, 403);
    const readable = response();
    controller.group(
      { params: { group: "sales" }, user: { id: admin.id, role: "cashier" } },
      readable,
    );
    assert.equal(readable.statusCode, 200);
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}
assert.equal(complete, true);
console.log("Settings integration test passed (transaction rolled back).");
