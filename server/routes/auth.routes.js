const express = require("express");

const AuthController = require("../controllers/auth.controller");

const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", AuthController.login);

router.post("/logout", authMiddleware, AuthController.logout);

router.get("/me", authMiddleware, AuthController.me);

module.exports = router;
