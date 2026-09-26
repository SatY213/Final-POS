const express = require("express");
const CashRegisterController = require("../controllers/cash-register.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", authMiddleware, CashRegisterController.getCashRegisters);
router.get("/:id", authMiddleware, CashRegisterController.getCashRegisterById);
router.post("/", authMiddleware, CashRegisterController.createCashRegister);
router.put("/:id", authMiddleware, CashRegisterController.updateCashRegister);

module.exports = router;
