const Unit = require("../models/unit.model");

function validate(body, excludedId = null) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const symbol = typeof body.symbol === "string" ? body.symbol.trim() : "";
  if (!name || !symbol) return { error: "Unit name and symbol are required" };
  if (Unit.duplicateExists(name, symbol, excludedId))
    return { error: "Unit name or symbol already exists", status: 409 };
  return { name, symbol };
}
function list(req, res) {
  try {
    return res.json({ units: Unit.findAll() });
  } catch (error) {
    console.error("List units error:", error);
    return res.status(500).json({ message: "Failed to load units" });
  }
}
function create(req, res) {
  try {
    const result = validate(req.body);
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    return res
      .status(201)
      .json({ unit: Unit.create(result.name, result.symbol) });
  } catch (error) {
    console.error("Create unit error:", error);
    return res.status(500).json({ message: "Failed to create unit" });
  }
}
function update(req, res) {
  try {
    const current = Unit.findById(req.params.id);
    if (!current)
      return res.status(404).json({ message: "Unit not found" });
    if (current.is_builtin)
      return res.status(409).json({ message: "The built-in generic unit cannot be edited" });
    const result = validate(req.body, req.params.id);
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    return res.json({
      unit: Unit.update(req.params.id, result.name, result.symbol),
    });
  } catch (error) {
    console.error("Update unit error:", error);
    return res.status(500).json({ message: "Failed to update unit" });
  }
}
function setStatus(req, res) {
  try {
    const current = Unit.findById(req.params.id);
    if (current?.is_builtin && req.body.is_active !== true)
      return res.status(409).json({ message: "The built-in generic unit cannot be deactivated" });
    const unit = Unit.setActive(req.params.id, req.body.is_active === true);
    return unit
      ? res.json({ unit })
      : res.status(404).json({ message: "Unit not found" });
  } catch (error) {
    console.error("Unit status error:", error);
    return res.status(500).json({ message: "Failed to update unit status" });
  }
}
module.exports = { list, create, update, setStatus };
