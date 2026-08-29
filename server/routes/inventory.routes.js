const express=require("express");
const controller=require("../controllers/inventory.controller");
const auth=require("../middleware/auth.middleware");
const router=express.Router();router.use(auth);
router.get("/",controller.list);router.get("/products",controller.products);router.get("/batches",controller.batches);router.get("/movements",controller.movements);
router.post("/receive",controller.receive);router.post("/adjust",controller.adjust);router.post("/transfer",controller.transfer);
module.exports=router;
