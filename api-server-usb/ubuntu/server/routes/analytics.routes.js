const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const controller = require("../controllers/analytics.controller");

router.use(auth);
router.get("/dashboard", controller.dashboard);
router.get("/reports", controller.report);

module.exports = router;
