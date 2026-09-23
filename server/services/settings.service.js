const db = require("../config/database");
const { SETTING_DEFINITIONS, GROUPS } = require("../config/settings");
class SettingsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
function parse(row, definition) {
  if (!row) return definition.default;
  if (row.value === null) return null;
  if (definition.type === "boolean") return row.value === "true";
  if (definition.type === "number") return Number(row.value);
  if (definition.type === "json") return JSON.parse(row.value);
  return row.value;
}
function normalize(key, value) {
  const definition = SETTING_DEFINITIONS[key];
  if (!definition) throw new SettingsError(`Unsupported setting: ${key}`);
  if (value == null && definition.nullable) return null;
  if (definition.type === "boolean" && typeof value !== "boolean")
    throw new SettingsError(`${key} must be boolean`);
  if (definition.type === "number") {
    value = Number(value);
    if (!Number.isFinite(value))
      throw new SettingsError(`${key} must be numeric`);
    if (
      (definition.min != null && value < definition.min) ||
      (definition.max != null && value > definition.max)
    )
      throw new SettingsError(`${key} is outside the allowed range`);
  }
  if (definition.type === "string") {
    value = String(value).trim();
    if (key === "general.logo_data" &&
      (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > 1400000))
      throw new SettingsError("Logo must be a PNG, JPEG or WebP image smaller than 1 MB");
    if (definition.allowed && !definition.allowed.includes(value))
      throw new SettingsError(`${key} is invalid`);
    if (definition.pattern && !definition.pattern.test(value))
      throw new SettingsError(`${key} has an invalid format`);
  }
  return value;
}
function serialize(value, type) {
  if (value === null) return null;
  if (type === "json") return JSON.stringify(value);
  return String(value);
}
function getGroup(group) {
  const prefix = GROUPS[group];
  if (!prefix) throw new SettingsError("Unknown settings group", 404);
  const rows = new Map(
    db
      .prepare("SELECT key,value,value_type FROM app_settings WHERE key LIKE ?")
      .all(`${prefix}.%`)
      .map((row) => [row.key, row]),
  );
  const values = {};
  for (const [key, definition] of Object.entries(SETTING_DEFINITIONS))
    if (key.startsWith(`${prefix}.`))
      values[key.slice(prefix.length + 1)] = parse(rows.get(key), definition);
  if (group === "sales" && values.default_customer_id != null)
    values.default_customer_valid = !!db
      .prepare("SELECT 1 FROM customers WHERE id=? AND is_active=1")
      .get(values.default_customer_id);
  return values;
}
const updateGroup = db.transaction((group, values, user) => {
  const prefix = GROUPS[group];
  if (!prefix) throw new SettingsError("Unknown settings group", 404);
  const allowed = Object.keys(SETTING_DEFINITIONS).filter((key) =>
      key.startsWith(`${prefix}.`),
    ),
    inputKeys = Object.keys(values);
  if (inputKeys.some((key) => !allowed.includes(`${prefix}.${key}`)))
    throw new SettingsError("Payload contains an unsupported setting");
  const normalized = {};
  for (const key of inputKeys)
    normalized[key] = normalize(`${prefix}.${key}`, values[key]);
  if (group === "sales" && normalized.default_customer_id != null) {
    const customer = db
      .prepare("SELECT is_active FROM customers WHERE id=?")
      .get(normalized.default_customer_id);
    if (!customer || !customer.is_active)
      throw new SettingsError("Default customer must be active");
  }
  if (
    group === "sales" &&
    normalized.quick_checkout_payment_method &&
    normalized.quick_checkout_payment_method !== "DEFAULT"
  ) {
    const method = db
      .prepare("SELECT is_active FROM payment_methods WHERE code=?")
      .get(normalized.quick_checkout_payment_method);
    if (!method || !method.is_active)
      throw new SettingsError("Quick checkout payment method must be active");
  }
  if (group === "payments" && normalized.default_method) {
    const method = db
      .prepare("SELECT is_active FROM payment_methods WHERE code=?")
      .get(normalized.default_method);
    if (!method || !method.is_active)
      throw new SettingsError("Default payment method must be active");
  }
  if (group === "general" && normalized.default_warehouse_id != null) {
    const warehouse = db
      .prepare("SELECT is_active FROM warehouses WHERE id=?")
      .get(normalized.default_warehouse_id);
    if (!warehouse?.is_active)
      throw new SettingsError("Default warehouse must be active");
  }
  if (group === "general" && normalized.default_cash_register_id != null) {
    const register = db
      .prepare("SELECT is_active,warehouse_id FROM cash_registers WHERE id=?")
      .get(normalized.default_cash_register_id);
    const warehouseId = normalized.default_warehouse_id ?? getGroup("general").default_warehouse_id;
    if (!register?.is_active)
      throw new SettingsError("Default cash register must be active");
    if (warehouseId && Number(register.warehouse_id) !== Number(warehouseId))
      throw new SettingsError("Default cash register must belong to the default warehouse");
  }
  const save = db.prepare(
    "INSERT INTO app_settings(key,value,value_type,updated_by) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,value_type=excluded.value_type,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP",
  );
  for (const [key, value] of Object.entries(normalized)) {
    const full = `${prefix}.${key}`,
      definition = SETTING_DEFINITIONS[full];
    save.run(full, serialize(value, definition.type), definition.type, user.id);
  }
  return getGroup(group);
});
function paymentMethods() {
  return db
    .prepare(
      "SELECT * FROM payment_methods WHERE code<>'CUSTOMER_CREDIT' ORDER BY sort_order,id",
    )
    .all();
}
function setPaymentActive(code, active) {
  if (code === "CUSTOMER_CREDIT")
    throw new SettingsError("Payment method not found", 404);
  const current = db
    .prepare("SELECT * FROM payment_methods WHERE code=?")
    .get(code);
  if (!current) throw new SettingsError("Payment method not found", 404);
  if (code === "CASH" && !active)
    throw new SettingsError("Cash payment method cannot be disabled");
  if (!active && getGroup("payments").default_method === code)
    throw new SettingsError("The default payment method cannot be disabled");
  db.prepare("UPDATE payment_methods SET is_active=? WHERE code=?").run(
    +active,
    code,
  );
  return paymentMethods();
}
function printers() {
  return db
    .prepare("SELECT * FROM printers ORDER BY printer_type,name COLLATE NOCASE")
    .all();
}
function savePrinter(data) {
  if (
    !data.name?.trim() ||
    !data.system_name?.trim() ||
    !["RECEIPT", "DOCUMENT", "LABEL", "GENERIC"].includes(data.printer_type)
  )
    throw new SettingsError("Printer details are invalid");
  if (data.id) {
    db.prepare(
      "UPDATE printers SET name=?,system_name=?,printer_type=?,workstation_id=?,is_default=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(
      data.name.trim(),
      data.system_name.trim(),
      data.printer_type,
      data.workstation_id || null,
      +!!data.is_default,
      +!!data.is_active,
      data.id,
    );
  } else
    db.prepare(
      "INSERT INTO printers(name,system_name,printer_type,workstation_id,is_default,is_active) VALUES(?,?,?,?,?,?)",
    ).run(
      data.name.trim(),
      data.system_name.trim(),
      data.printer_type,
      data.workstation_id || null,
      +!!data.is_default,
      data.is_active === false ? 0 : 1,
    );
  return printers();
}
function profiles() {
  const logo_data = getGroup("general").logo_data;
  return db
    .prepare(
      "SELECT pp.*,p.name printer_name,p.system_name FROM print_profiles pp LEFT JOIN printers p ON p.id=pp.printer_id ORDER BY pp.id",
    )
    .all()
    .map((row) => ({
      ...row,
      logo_data,
      configuration: JSON.parse(row.configuration_json || "{}"),
    }));
}
function saveProfile(type, data) {
  if (
    ![
      "SALE",
      "SALE_TICKET",
      "SALE_INVOICE",
      "SHIPPING_INVOICE",
      "INVOICE",
      "QUOTE",
      "SALES_RETURN",
      "PURCHASE_ORDER",
      "PURCHASE_RECEIPT",
      "PURCHASE_RETURN",
      "BARCODE_LABEL",
    ].includes(type)
  )
    throw new SettingsError("Document type is invalid");
  if (
    !Number.isInteger(Number(data.copies)) ||
    data.copies < 1 ||
    data.copies > 10
  )
    throw new SettingsError("Copies must be between 1 and 10");
  const formats = {
    SALE: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
    SALE_TICKET: ["THERMAL_80", "THERMAL_58"],
    SALE_INVOICE: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
    SHIPPING_INVOICE: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
    INVOICE: ["A4", "A5"],
    QUOTE: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
    SALES_RETURN: ["A4", "A5", "80mm", "58mm"],
    PURCHASE_ORDER: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
    PURCHASE_RECEIPT: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
    PURCHASE_RETURN: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
    BARCODE_LABEL: ["40x25mm", "50x30mm", "60x40mm", "CUSTOM"],
  };
  if (!formats[type].includes(data.paper_format))
    throw new SettingsError("Paper format is invalid");
  if (
    !data.configuration ||
    typeof data.configuration !== "object" ||
    Array.isArray(data.configuration)
  )
    throw new SettingsError("Profile configuration must be an object");
  const commonKeys = ["show_logo", "show_legal_info", "footer_message", "title"],
    allowedKeys = {
      SALE: [
        ...commonKeys,
        "default_document",
        "show_warehouse_name",
        "show_address",
        "show_phone",
        "show_email",
        "show_cashier",
        "show_cash_register",
        "show_customer",
        "show_product_reference",
        "show_payment_details",
        "show_received_amount",
        "show_change",
        "orientation",
      ],
      SALE_TICKET: [],
      SALE_INVOICE: [],
      SHIPPING_INVOICE: [],
      INVOICE: [],
      QUOTE: [
        ...commonKeys,
        "show_product_reference",
        "show_signature_area",
        "show_discounts",
      ],
      SALES_RETURN: [
        ...commonKeys,
        "show_product_reference",
        "show_discounts",
      ],
      PURCHASE_ORDER: [...commonKeys, "show_warehouse_name", "show_address", "show_phone", "show_email", "show_customer", "show_product_reference", "show_discounts"],
      PURCHASE_RECEIPT: [...commonKeys, "show_warehouse_name", "show_address", "show_phone", "show_email", "show_customer", "show_product_reference", "show_discounts"],
      PURCHASE_RETURN: [...commonKeys, "show_warehouse_name", "show_address", "show_phone", "show_email", "show_customer", "show_product_reference", "show_discounts"],
      BARCODE_LABEL: [
        "show_product_name",
        "show_price",
        "show_reference",
        "symbology",
        "label_width_mm",
        "label_height_mm",
        "name_font_size",
        "price_font_size",
        "reference_font_size",
        "barcode_height_mm",
        "price_position",
        "show_barcode_text",
        "content_gap_mm",
        "label_padding_mm",
      ],
    };
  const saleProfileTypes = ["SALE_TICKET", "SALE_INVOICE", "SHIPPING_INVOICE", "INVOICE"];
  if (saleProfileTypes.includes(type)) {
    allowedKeys[type] = [
      ...commonKeys,
      "title",
      "show_warehouse_name",
      "show_address",
      "show_phone",
      "show_email",
      "show_cashier",
      "show_cash_register",
      "show_customer",
      "show_product_reference",
      "show_payment_details",
      "show_received_amount",
      "show_change",
      "orientation",
      ...(type === "SALE_TICKET" ? [] : ["show_discounts"]),
    ];
  }
  if (
    Object.keys(data.configuration).some(
      (key) => !allowedKeys[type].includes(key),
    )
  )
    throw new SettingsError(
      "Profile configuration contains an unsupported option",
    );
  if (
    type === "BARCODE_LABEL" &&
    !["CODE128", "EAN13"].includes(data.configuration.symbology || "CODE128")
  )
    throw new SettingsError("Barcode symbology is invalid");
  if (type === "BARCODE_LABEL") {
    const numeric = {
      label_width_mm: [20, 150],
      label_height_mm: [15, 100],
      name_font_size: [6, 30],
      price_font_size: [6, 36],
      reference_font_size: [6, 24],
      barcode_height_mm: [6, 60],
      content_gap_mm: [0, 10],
      label_padding_mm: [0, 10],
    };
    for (const [key, [min, max]] of Object.entries(numeric)) {
      if (data.configuration[key] == null) continue;
      const value = Number(data.configuration[key]);
      if (!Number.isFinite(value) || value < min || value > max)
        throw new SettingsError(`${key} is outside the allowed range`);
    }
    if (!["TOP", "BOTTOM"].includes(data.configuration.price_position || "TOP"))
      throw new SettingsError("Price position is invalid");
  }
  if (
    type === "SALE" &&
    !["PORTRAIT", "LANDSCAPE"].includes(
      data.configuration.orientation || "PORTRAIT",
    )
  )
    throw new SettingsError("Invoice orientation is invalid");
  if (data.printer_id) {
    const printer = db
        .prepare("SELECT printer_type,is_active FROM printers WHERE id=?")
        .get(data.printer_id),
      expected =
        ["58mm", "80mm", "THERMAL_80", "THERMAL_58"].includes(
          data.paper_format,
        ) && type !== "BARCODE_LABEL"
          ? "RECEIPT"
          : {
              SALE: "DOCUMENT",
              SALE_TICKET: "RECEIPT",
              SALE_INVOICE: "DOCUMENT",
              SHIPPING_INVOICE: "DOCUMENT",
              INVOICE: "DOCUMENT",
              QUOTE: "DOCUMENT",
              SALES_RETURN: "DOCUMENT",
              PURCHASE_ORDER: "DOCUMENT",
              PURCHASE_RECEIPT: "DOCUMENT",
              PURCHASE_RETURN: "DOCUMENT",
              BARCODE_LABEL: "LABEL",
            }[type];
    if (!printer?.is_active)
      throw new SettingsError("Assigned printer must be active");
    if (![expected, "GENERIC"].includes(printer.printer_type))
      throw new SettingsError("Printer type is incompatible with this profile");
  }
  db.prepare(
    "UPDATE print_profiles SET printer_id=?,paper_format=?,auto_print=?,copies=?,configuration_json=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE document_type=?",
  ).run(
    data.printer_id || null,
    data.paper_format,
    +!!data.auto_print,
    Number(data.copies),
    JSON.stringify(data.configuration || {}),
    data.is_active === false ? 0 : 1,
    type,
  );
  return profiles().find((row) => row.document_type === type);
}
const documentPrefixes = {
  SALE: "VNT",
  QUOTE: "DEV",
  DELIVERY_NOTE: "BL",
  SALE_INVOICE: "FAC",
  INVOICE: "FAC",
  SALES_RETURN: "RET",
  CREDIT_NOTE: "AVO",
  PURCHASE_ORDER: "BC",
  PURCHASE_RECEIPT: "BR",
  SUPPLIER_RETURN: "RF",
};

function formatDocumentNumber(documentType, sequence) {
  if (!documentPrefixes[documentType])
    throw new SettingsError("Unsupported document sequence");
  const value = getGroup("numbering");
  const parts = [
    documentType === "SALE" ? value.sale_prefix : documentPrefixes[documentType],
  ];
  if (value.sale_include_year) parts.push(String(new Date().getFullYear()));
  parts.push(String(sequence).padStart(value.sale_padding, "0"));
  return parts.join("-");
}

function numberingPreview(documentType = "SALE") {
  const current = Number(
    db
      .prepare(
        "SELECT current_value FROM document_sequences WHERE document_type=?",
      )
      .get(documentType)?.current_value || 0,
  );
  return formatDocumentNumber(documentType, current + 1);
}

const nextDocumentNumber = db.transaction((documentType = "SALE", warehouseId = null) => {
  if (!documentPrefixes[documentType])
    throw new SettingsError("Unsupported document sequence");
  const scoped = Number.isInteger(Number(warehouseId)) && Number(warehouseId) > 0;
  // Document numbers are constrained as globally unique in SQLite.  Keep the
  // warehouse counter for reporting, but use the global counter as the number
  // source so two warehouses can never both generate VNT-…000001.
  db.prepare("INSERT OR IGNORE INTO document_sequences(document_type,current_value) VALUES(?,0)").run(documentType);
  db.prepare("UPDATE document_sequences SET current_value=current_value+1,updated_at=CURRENT_TIMESTAMP WHERE document_type=?").run(documentType);
  if (scoped) {
    db.prepare("INSERT OR IGNORE INTO warehouse_document_sequences(warehouse_id,document_type,current_value) VALUES(?,?,0)").run(Number(warehouseId), documentType);
    db.prepare("UPDATE warehouse_document_sequences SET current_value=current_value+1,updated_at=CURRENT_TIMESTAMP WHERE warehouse_id=? AND document_type=?").run(Number(warehouseId), documentType);
  }
  const sequence = db.prepare("SELECT current_value FROM document_sequences WHERE document_type=?").get(documentType).current_value;
  return formatDocumentNumber(documentType, sequence);
});
module.exports = {
  SettingsError,
  getGroup,
  updateGroup,
  paymentMethods,
  setPaymentActive,
  printers,
  savePrinter,
  profiles,
  saveProfile,
  numberingPreview,
  nextDocumentNumber,
};
