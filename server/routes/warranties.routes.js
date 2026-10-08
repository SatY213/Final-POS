"use strict";

const router = require("express").Router();
const controller = require("../controllers/warranty.controller");
const auth = require("../middleware/auth.middleware");

router.use(auth);
router.get("/", controller.list);
router.get("/context", controller.context);
router.get("/:id", controller.detail);
router.post("/", controller.create);
router.put("/:id", controller.update);

module.exports = router;

