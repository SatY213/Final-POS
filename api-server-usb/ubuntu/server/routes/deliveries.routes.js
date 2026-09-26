const router=require("express").Router(),controller=require("../controllers/commercial.controller"),auth=require("../middleware/auth.middleware");
router.use(auth);router.get("/",controller.deliveries);router.get("/:id",controller.delivery);router.post("/:id/ship",controller.validateDelivery);router.post("/:id/deliver",controller.deliverDelivery);module.exports=router;
