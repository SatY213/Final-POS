const Warehouse = require("../models/warehouse.model");

function createWarehouse(req, res) {
  try {
    const {
      name,
      phone,
      email,
      nif,
      nis,
      tax_article,
      commercial_register,
      address,
      business_activity,
      can_sell,
      is_active,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Warehouse name is required",
      });
    }

    const warehouse = Warehouse.create({
      name: name.trim(),
      phone,
      email,
      nif,
      nis,
      tax_article,
      commercial_register,
      address,
      business_activity,
      can_sell,
      is_active,
    });

    return res.status(201).json({
      warehouse,
    });
  } catch (error) {
    console.error("Create warehouse error:", error);

    return res.status(500).json({
      message: "Failed to create warehouse",
    });
  }
}

function getWarehouses(req, res) {
  try {
    const warehouses = Warehouse.findAll();

    return res.json({
      warehouses,
    });
  } catch (error) {
    console.error("Get warehouses error:", error);

    return res.status(500).json({
      message: "Failed to load warehouses",
    });
  }
}

function getWarehouseById(req, res) {
  try {
    const warehouse = Warehouse.findById(req.params.id);

    if (!warehouse) {
      return res.status(404).json({
        message: "Warehouse not found",
      });
    }

    return res.json({
      warehouse,
    });
  } catch (error) {
    console.error("Get warehouse error:", error);

    return res.status(500).json({
      message: "Failed to load warehouse",
    });
  }
}

function updateWarehouse(req, res) {
  try {
    const existingWarehouse = Warehouse.findById(req.params.id);

    if (!existingWarehouse) {
      return res.status(404).json({
        message: "Warehouse not found",
      });
    }

    const {
      name,
      phone,
      email,
      nif,
      nis,
      tax_article,
      commercial_register,
      address,
      business_activity,
      can_sell,
      is_active,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Warehouse name is required",
      });
    }

    const warehouse = Warehouse.update(req.params.id, {
      name: name.trim(),
      phone,
      email,
      nif,
      nis,
      tax_article,
      commercial_register,
      address,
      business_activity,
      can_sell,
      is_active,
    });

    return res.json({
      warehouse,
    });
  } catch (error) {
    console.error("Update warehouse error:", error);

    return res.status(500).json({
      message: "Failed to update warehouse",
    });
  }
}

module.exports = {
  createWarehouse,
  getWarehouses,
  getWarehouseById,
  updateWarehouse,
};
