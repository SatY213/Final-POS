const Purchases = require("../services/purchase.service");
const handle = (res, fn, status = 200) => {
  try { res.status(status).json(fn()); }
  catch (error) { console.error("Purchase error", error); res.status(error.status || 500).json({ message: error.message || "Purchase operation failed" }); }
};
exports.context = (req, res) => handle(res, () => Purchases.context(req.query, req.user));
exports.createSupplier = (req, res) => handle(res, () => ({ supplier: Purchases.createSupplier(req.body, req.user) }), 201);
exports.orders = (req, res) => handle(res, () => ({ orders: Purchases.listOrders(req.query, req.user) }));
exports.order = (req, res) => handle(res, () => ({ order: Purchases.orderDetail(req.params.id, req.user) }));
exports.createOrder = (req, res) => handle(res, () => ({ order: Purchases.createOrder(req.body, req.user) }), 201);
exports.receipts = (req, res) => handle(res, () => ({ receipts: Purchases.listReceipts(req.query, req.user) }));
exports.receipt = (req, res) => handle(res, () => ({ receipt: Purchases.receiptDetail(req.params.id, req.user) }));
exports.createReceipt = (req, res) => handle(res, () => ({ receipt: Purchases.createReceipt(req.body, req.user) }), 201);
exports.updateReceipt = (req, res) => handle(res, () => ({ receipt: Purchases.updateReceipt(req.params.id, req.body, req.user) }));
exports.addReceiptPayment = (req, res) => handle(res, () => ({ receipt: Purchases.addReceiptPayment(req.params.id, req.body, req.user) }), 201);
exports.returns = (req, res) => handle(res, () => ({ returns: Purchases.listReturns(req.query, req.user) }));
exports.returnDetail = (req, res) => handle(res, () => ({ return_document: Purchases.returnDetail(req.params.id, req.user) }));
exports.createReturn = (req, res) => handle(res, () => ({ return_document: Purchases.createReturn(req.params.id, req.body, req.user) }), 201);
