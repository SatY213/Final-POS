const express = require("express");
const WarehouseController = require("../controllers/warehouse.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", authMiddleware, WarehouseController.getWarehouses);

router.get("/:id", authMiddleware, WarehouseController.getWarehouseById);

router.post("/", authMiddleware, WarehouseController.createWarehouse);

router.put("/:id", authMiddleware, WarehouseController.updateWarehouse);

module.exports = router;
