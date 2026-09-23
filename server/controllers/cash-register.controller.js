const CashRegister = require("../models/cash-register.model");

function validate(body, excludedId = null) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const warehouseId = Number(body.warehouse_id);

  if (!name) return { error: "Cash register name is required" };
  if (!code) return { error: "Cash register code is required" };
  if (!Number.isInteger(warehouseId) || warehouseId < 1) {
    return { error: "A valid warehouse is required" };
  }
  if (!CashRegister.warehouseExists(warehouseId)) {
    return { error: "Warehouse not found" };
  }
  if (CashRegister.codeExists(code, excludedId)) {
    return { error: "Cash register code already exists", status: 409 };
  }
  return {
    value: {
      warehouse_id: warehouseId,
      name,
      code,
      is_active: body.is_active !== false,
    },
  };
}

function getCashRegisters(req, res) {
  try {
    return res.json({ cash_registers: CashRegister.findAll() });
  } catch (error) {
    console.error("Get cash registers error:", error);
    return res.status(500).json({ message: "Failed to load cash registers" });
  }
}

function getCashRegisterById(req, res) {
  try {
    const cashRegister = CashRegister.findById(req.params.id);
    if (!cashRegister)
      return res.status(404).json({ message: "Cash register not found" });
    return res.json({ cash_register: cashRegister });
  } catch (error) {
    console.error("Get cash register error:", error);
    return res.status(500).json({ message: "Failed to load cash register" });
  }
}

function createCashRegister(req, res) {
  try {
    const validation = validate(req.body);
    if (validation.error)
      return res
        .status(validation.status || 400)
        .json({ message: validation.error });
    return res
      .status(201)
      .json({ cash_register: CashRegister.create(validation.value) });
  } catch (error) {
    console.error("Create cash register error:", error);
    return res.status(500).json({ message: "Failed to create cash register" });
  }
}

function updateCashRegister(req, res) {
  try {
    if (!CashRegister.findById(req.params.id)) {
      return res.status(404).json({ message: "Cash register not found" });
    }
    const validation = validate(req.body, req.params.id);
    if (validation.error)
      return res
        .status(validation.status || 400)
        .json({ message: validation.error });
    return res.json({
      cash_register: CashRegister.update(req.params.id, validation.value),
    });
  } catch (error) {
    console.error("Update cash register error:", error);
    return res.status(500).json({ message: "Failed to update cash register" });
  }
}

module.exports = {
  getCashRegisters,
  getCashRegisterById,
  createCashRegister,
  updateCashRegister,
};
