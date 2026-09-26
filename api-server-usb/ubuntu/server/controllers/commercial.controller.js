const Commercial = require("../services/commercial.service");
const Deliveries = require("../services/delivery.service");
function handle(res, action, status = 200) {
  try { return res.status(status).json(action()); }
  catch (error) { console.error("Commercial error", error); return res.status(error.status || 500).json({ message: error.status ? error.message : "Commercial operation failed" }); }
}
module.exports = {
  quotes: (req,res)=>handle(res,()=>Commercial.listQuotes(req.query,req.user)),
  quote: (req,res)=>handle(res,()=>({quote:Commercial.quoteDetail(req.params.id,req.user)})),
  saveQuote: (req,res)=>handle(res,()=>({quote:Commercial.saveQuote(req.body,req.user)}),201),
  updateQuote: (req,res)=>handle(res,()=>({quote:Commercial.updateQuote(req.params.id,req.body,req.user)})),
  quoteStatus: (req,res)=>handle(res,()=>({quote:Commercial.setQuoteStatus(req.params.id,req.body.status,req.user)})),
  deliveries: (req,res)=>handle(res,()=>Deliveries.list(req.query,req.user)),
  delivery: (req,res)=>handle(res,()=>({delivery:Deliveries.detail(req.params.id,req.user)})),
  validateDelivery: (req,res)=>handle(res,()=>({delivery:Deliveries.ship(req.params.id,req.user)})),
  deliverDelivery: (req,res)=>handle(res,()=>({delivery:Deliveries.deliver(req.params.id,req.user)})),
  addPayment: (req,res)=>handle(res,()=>({payment_summary:Commercial.addPayment(req.params.id,req.body,req.user)}),201),
  createReturn: (req,res)=>handle(res,()=>({return_document:Commercial.createReturn(req.params.id,req.body,req.user)}),201),
  returnDocument: (req,res)=>handle(res,()=>({return_document:Commercial.returnDetail(req.params.id,req.user)})),
};
