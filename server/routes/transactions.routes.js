const router=require("express").Router(), auth=require("../middleware/auth.middleware"), controller=require("../controllers/transaction.controller");
router.use(auth); router.get("/",controller.list); module.exports=router;
