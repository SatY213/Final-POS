const Invoice = require("../services/invoice.service");
const Settings = require("../services/settings.service");

function run(res, action, status = 200) {
  try {
    return res.status(status).json(action());
  } catch (error) {
    console.error("Invoice error", error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Invoice operation failed",
    });
  }
}

module.exports = {
  list: (req, res) => run(res, () => Invoice.list(req.query, req.user)),
  context: (req, res) => run(res, () => Invoice.context(req.query, req.user)),
  eligibleSales: (req, res) => run(res, () => ({ sales: Invoice.eligibleSales(req.query, req.user) })),
  detail: (req, res) => run(res, () => ({ invoice: Invoice.detail(req.params.id, req.user) })),
  create: (req, res) => run(res, () => ({ invoice: Invoice.createForSales(req.body.sale_ids, req.body, req.user) }), 201),
  addPayment: (req, res) => run(res, () => ({ invoice: Invoice.addPayment(req.params.id, req.body, req.user) }), 201),
  update: (req, res) => run(res, () => ({ invoice: Invoice.update(req.params.id, req.body, req.user) })),
  createFromSale: (req, res) => run(res, () => ({
    invoice: Invoice.createForSales([req.params.id], { ...Settings.getGroup("invoicing"), ...req.body }, req.user),
  }), 201),
};
