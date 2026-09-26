const router = require("express").Router(),
  controller = require("../controllers/pos.controller"),
  auth = require("../middleware/auth.middleware");
router.use(auth);
router.get("/context", controller.context);
router.get("/search-products", controller.search);
router.get("/customers", controller.customers);
router.get("/products/:id/units", controller.units);
router.get("/products/:id/serials", controller.serials);
router.post("/products/:id/serials", controller.addSerial);
router.get("/suspended", controller.suspended);
router.get("/sales/:id", controller.sale);
router.put("/sales/:id", controller.editSale);
router.post("/sales", controller.finalize);
router.post("/suspend", controller.suspend);
module.exports = router;
