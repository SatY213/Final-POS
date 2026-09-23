const Pos = require("../services/pos.service");
const db = require("../config/database");
const Invoice = require("../services/invoice.service");
const Settings = require("../services/settings.service");
function run(res, action, status = 200) {
  try {
    return res.status(status).json(action());
  } catch (error) {
    console.error("POS error", error);
    const accountConflict =
      error.code === "SQLITE_CONSTRAINT_UNIQUE" &&
      String(error.message).includes("customer_account_entries.sale_id");
    return res.status(accountConflict ? 409 : error.status || 500).json({
      message: accountConflict
        ? "Customer balance entry already exists for this sale"
        : error.message || "Sale operation failed",
    });
  }
}
module.exports = {
  context(req, res) {
    return run(res, () => Pos.context(req.user, req.query.warehouse_id));
  },
  search(req, res) {
    return run(res, () => ({
      products: Pos.searchProducts(
        req.query.q,
        req.query.warehouse_id,
        req.user,
      ),
    }));
  },
  customers(req, res) {
    return run(res, () => ({ customers: Pos.customerSearch(req.query.q) }));
  },
  units(req, res) {
    return run(res, () => ({ units: Pos.productUnits(req.params.id) }));
  },
  serials(req, res) {
    return run(res, () => ({
      serials: Pos.availableSerials(
        req.params.id,
        req.query.warehouse_id,
        req.user,
      ),
    }));
  },
  addSerial(req, res) {
    return run(
      res,
      () => ({
        serial: Pos.addAvailableSerial(
          req.params.id,
          req.body.warehouse_id,
          req.body.serial_number,
          req.user,
        ),
      }),
      201,
    );
  },
  finalize(req, res) {
    return run(res, () => db.transaction(() => {
      let sale = Pos.finalize(req.body, req.user);
      const documentType = req.body.document_type === "BON_POUR" ? "BON_POUR" : "TICKET";
      db.prepare("UPDATE sales SET document_type=? WHERE id=?").run(documentType, sale.id);
      let invoice = null;
      if (req.body.invoice_requested) {
        invoice = Invoice.createForSales([sale.id], {
          ...Settings.getGroup("invoicing"),
          client_request_id: `invoice:${req.body.client_request_id}`,
          invoice_date: req.body.sale_date,
        }, req.user);
      }
      sale = Pos.getSale(sale.id, req.user);
      return { sale: { ...sale, invoice } };
    })(), 201);
  },
  suspend(req, res) {
    return run(res, () => ({ sale: Pos.suspend(req.body, req.user) }), 201);
  },
  suspended(req, res) {
    return run(res, () => ({
      sales: Pos.suspended(req.user, req.query.warehouse_id),
    }));
  },
  sale(req, res) {
    return run(res, () => ({ sale: Pos.getSale(req.params.id, req.user) }));
  },
  editSale(req, res) {
    return run(res, () => ({
      sale: Pos.editSale(req.params.id, req.body, req.user),
    }));
  },
};
