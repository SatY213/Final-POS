const router = require("express").Router();
const controller = require("../controllers/sales.controller");
const auth = require("../middleware/auth.middleware");

router.use(auth);
router.get("/", controller.list);
router.get("/options", controller.options);
router.post("/:id/payments", require("../controllers/commercial.controller").addPayment);
router.post("/:id/returns", require("../controllers/commercial.controller").createReturn);
router.post("/:id/invoice", require("../controllers/invoice.controller").createFromSale);
router.get("/:id", controller.detail);

module.exports = router;
