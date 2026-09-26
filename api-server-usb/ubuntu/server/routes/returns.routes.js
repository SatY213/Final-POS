const router=require("express").Router(),controller=require("../controllers/commercial.controller"),auth=require("../middleware/auth.middleware");
router.use(auth);router.get("/:id",controller.returnDocument);module.exports=router;
