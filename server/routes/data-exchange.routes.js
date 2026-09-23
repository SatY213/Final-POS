const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const controller = require("../controllers/data-exchange.controller");
router.use(auth);
router.get("/templates/:entity", controller.template);
router.post("/import/:entity/preview", controller.preview);
router.post("/import/:entity/commit", controller.commit);
router.get("/export/:entity", controller.exportCsv);
module.exports = router;
