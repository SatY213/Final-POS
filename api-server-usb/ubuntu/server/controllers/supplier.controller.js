const Supplier = require("../models/supplier.model");
const { validatePartner, canManagePartners } = require("../utils/partner");
const { parsePagination } = require("../utils/request");

const validate = (body) => validatePartner(body, "Supplier");
function forbidden(req, res) {
  if (canManagePartners(req.user)) return false;
  res
    .status(403)
    .json({ message: "Only administrators and managers can manage suppliers" });
  return true;
}

module.exports = {
  list(req, res) {
    try {
      const { page, limit } = parsePagination(req.query);
      return res.json(
        Supplier.findPage({
          page,
          limit,
          search: String(req.query.search || "").trim(),
          status: ["active", "inactive", "all"].includes(req.query.status)
            ? req.query.status
            : "active",
        }),
      );
    } catch (error) {
      console.error("Load suppliers error:", error);
      return res.status(500).json({ message: "Failed to load suppliers" });
    }
  },
  getById(req, res) {
    try {
      const supplier = Supplier.findById(req.params.id);
      return supplier
        ? res.json({ supplier })
        : res.status(404).json({ message: "Supplier not found" });
    } catch (error) {
      console.error("Load supplier error:", error);
      return res.status(500).json({ message: "Failed to load supplier" });
    }
  },
  create(req, res) {
    if (forbidden(req, res)) return;
    const result = validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    try {
      return res.status(201).json({ supplier: Supplier.create(result.value) });
    } catch (error) {
      console.error("Create supplier error:", error);
      return res.status(500).json({ message: "Failed to create supplier" });
    }
  },
  update(req, res) {
    if (forbidden(req, res)) return;
    if (!Supplier.findById(req.params.id))
      return res.status(404).json({ message: "Supplier not found" });
    const result = validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    try {
      return res.json({ supplier: Supplier.update(req.params.id, result.value) });
    } catch (error) {
      console.error("Update supplier error:", error);
      return res.status(500).json({ message: "Failed to update supplier" });
    }
  },
  setStatus(req, res) {
    if (forbidden(req, res)) return;
    if (typeof req.body.is_active !== "boolean")
      return res
        .status(400)
        .json({ message: "Supplier status must be a boolean" });
    try {
      const supplier = Supplier.setActive(req.params.id, req.body.is_active);
      return supplier
        ? res.json({ supplier })
        : res.status(404).json({ message: "Supplier not found" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Failed to update supplier status" });
    }
  },
  remove(req, res) {
    if (forbidden(req, res)) return;
    try {
      const supplier = Supplier.remove(req.params.id);
      return supplier
        ? res.json({ deleted: true, supplier })
        : res.status(404).json({ message: "Supplier not found" });
    } catch (error) {
      if (error instanceof Supplier.SupplierInUseError)
        return res.status(409).json({ message: error.message, uses: error.uses });
      console.error("Delete supplier error:", error);
      return res.status(500).json({ message: "Failed to delete supplier" });
    }
  },
};
