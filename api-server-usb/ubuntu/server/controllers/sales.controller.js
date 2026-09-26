const Sales = require("../services/sales.service");

function handle(res, action) {
  try {
    return res.json(action());
  } catch (error) {
    console.error("Sales error", error);
    return res
      .status(error.status || 500)
      .json({
        message: error.status ? error.message : "Sales operation failed",
      });
  }
}

module.exports = {
  list: (req, res) => handle(res, () => Sales.list(req.query, req.user)),
  options: (req, res) => handle(res, () => Sales.options(req.query, req.user)),
  detail: (req, res) =>
    handle(res, () => ({ sale: Sales.detail(req.params.id, req.user) })),
};
