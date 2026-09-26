const DEFAULT_WAREHOUSE_NAME = "Entrepôt principal";
const DEFAULT_REGISTER_NAME = "Caisse principale";
const DEFAULT_REGISTER_CODE = "MAIN";

function settingExists(db, key) {
  return Boolean(db.prepare("SELECT 1 FROM app_settings WHERE key=?").get(key));
}

function saveDefaultSetting(db, key, value) {
  if (settingExists(db, key)) return;
  db.prepare(
    "INSERT INTO app_settings(key,value,value_type,updated_by) VALUES(?,?, 'number', NULL)",
  ).run(key, String(value));
}

/**
 * Creates only the records required to use a brand-new installation.
 * It is deliberately idempotent and never replaces existing configuration or
 * business data.
 */
function ensureStartupData(db) {
  return db.transaction(() => {
    let warehouse = db
      .prepare(
        "SELECT id FROM warehouses WHERE is_active=1 AND can_sell=1 ORDER BY id LIMIT 1",
      )
      .get();
    let warehouseCreated = false;
    if (!warehouse) {
      const result = db
        .prepare(
          "INSERT INTO warehouses(name,can_sell,is_active) VALUES(?,1,1)",
        )
        .run(DEFAULT_WAREHOUSE_NAME);
      warehouse = { id: Number(result.lastInsertRowid) };
      warehouseCreated = true;
    }

    let cashRegister = db
      .prepare(
        "SELECT id FROM cash_registers WHERE warehouse_id=? AND is_active=1 ORDER BY id LIMIT 1",
      )
      .get(warehouse.id);
    let cashRegisterCreated = false;
    if (!cashRegister) {
      let code = DEFAULT_REGISTER_CODE;
      let suffix = 1;
      while (
        db.prepare("SELECT 1 FROM cash_registers WHERE code=? COLLATE NOCASE").get(code)
      ) {
        suffix += 1;
        code = `${DEFAULT_REGISTER_CODE}-${suffix}`;
      }
      const result = db
        .prepare(
          "INSERT INTO cash_registers(warehouse_id,name,code,is_active) VALUES(?,?,?,1)",
        )
        .run(warehouse.id, DEFAULT_REGISTER_NAME, code);
      cashRegister = { id: Number(result.lastInsertRowid) };
      cashRegisterCreated = true;
    }

    const administrators = db
      .prepare("SELECT id,warehouse_id FROM users WHERE role='admin' AND is_active=1")
      .all();
    const setUserWarehouse = db.prepare(
      "UPDATE users SET warehouse_id=? WHERE id=? AND warehouse_id IS NULL",
    );
    const linkWarehouse = db.prepare(
      "INSERT OR IGNORE INTO user_warehouses(user_id,warehouse_id) VALUES(?,?)",
    );
    for (const administrator of administrators) {
      setUserWarehouse.run(warehouse.id, administrator.id);
      linkWarehouse.run(administrator.id, warehouse.id);
    }

    saveDefaultSetting(db, "general.default_warehouse_id", warehouse.id);
    saveDefaultSetting(db, "general.default_cash_register_id", cashRegister.id);

    return {
      warehouseId: Number(warehouse.id),
      cashRegisterId: Number(cashRegister.id),
      warehouseCreated,
      cashRegisterCreated,
    };
  })();
}

module.exports = {
  ensureStartupData,
  DEFAULT_WAREHOUSE_NAME,
  DEFAULT_REGISTER_NAME,
  DEFAULT_REGISTER_CODE,
};
