const express = require("express");
const UserController = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = express.Router();
router.get("/", authMiddleware, UserController.getUsers);
router.get("/:id", authMiddleware, UserController.getUserById);
router.post("/", authMiddleware, UserController.createUser);
router.put("/:id", authMiddleware, UserController.updateUser);
module.exports = router;
