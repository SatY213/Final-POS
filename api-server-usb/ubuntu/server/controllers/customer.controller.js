const Customer = require("../models/customer.model");
const { validatePartner, canManagePartners } = require("../utils/partner");
const { parsePagination } = require("../utils/request");
const validate = (body) => validatePartner(body, "Customer");
function forbidden(req, res) {
  if (canManagePartners(req.user)) return false;
  res
    .status(403)
    .json({ message: "Only administrators and managers can manage customers" });
  return true;
}
module.exports = {
  list(req, res) {
    try {
      const { page, limit } = parsePagination(req.query);
      return res.json(
        Customer.findPage({
          page,
          limit,
          search: String(req.query.search || "").trim(),
          status: ["active", "inactive", "all"].includes(req.query.status)
            ? req.query.status
            : "active",
        }),
      );
    } catch (error) {
      return res.status(500).json({ message: "Failed to load customers" });
    }
  },
  getById(req, res) {
    try {
      const customer = Customer.findById(req.params.id);
      return customer
        ? res.json({ customer })
        : res.status(404).json({ message: "Customer not found" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to load customer" });
    }
  },
  create(req, res) {
    if (forbidden(req, res)) return;
    const result = validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    try {
      return res.status(201).json({ customer: Customer.create(result.value) });
    } catch (error) {
      return res.status(500).json({ message: "Failed to create customer" });
    }
  },
  update(req, res) {
    if (forbidden(req, res)) return;
    if (!Customer.findById(req.params.id))
      return res.status(404).json({ message: "Customer not found" });
    const result = validate(req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    try {
      return res.json({
        customer: Customer.update(req.params.id, result.value),
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update customer" });
    }
  },
  setStatus(req, res) {
    if (forbidden(req, res)) return;
    if (typeof req.body.is_active !== "boolean")
      return res
        .status(400)
        .json({ message: "Customer status must be a boolean" });
    try {
      const customer = Customer.setActive(req.params.id, req.body.is_active);
      return customer
        ? res.json({ customer })
        : res.status(404).json({ message: "Customer not found" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Failed to update customer status" });
    }
  },
  remove(req, res) {
    if (forbidden(req, res)) return;
    try {
      const customer = Customer.remove(req.params.id);
      return customer
        ? res.json({ deleted: true, customer })
        : res.status(404).json({ message: "Customer not found" });
    } catch (error) {
      if (error instanceof Customer.CustomerInUseError)
        return res.status(409).json({
          message: "Customer cannot be permanently deleted because it is used by existing documents or account entries",
          uses: error.uses,
        });
      console.error("Delete customer error:", error);
      return res.status(500).json({ message: "Failed to delete customer" });
    }
  },
};
