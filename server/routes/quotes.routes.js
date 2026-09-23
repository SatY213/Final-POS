const router=require("express").Router(),controller=require("../controllers/commercial.controller"),auth=require("../middleware/auth.middleware");
router.use(auth);router.get("/",controller.quotes);router.post("/",controller.saveQuote);router.get("/:id",controller.quote);router.put("/:id",controller.updateQuote);router.patch("/:id/status",controller.quoteStatus);module.exports=router;
