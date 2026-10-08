"use strict";

const Warranty = require("../services/warranty.service");

function handle(res, action, created = false) {
  try {
    const warranty = action();
    return res.status(created ? 201 : 200).json(warranty?.items ? warranty : { warranty });
  } catch (error) {
    console.error("Warranty error", error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Warranty operation failed",
    });
  }
}

module.exports = {
  list(req, res) {
    try { return res.json(Warranty.list(req.query, req.user)); }
    catch (error) { return handle(res, () => { throw error; }); }
  },
  context(req, res) {
    try { return res.json(Warranty.context(req.query, req.user)); }
    catch (error) { return handle(res, () => { throw error; }); }
  },
  detail: (req, res) => handle(res, () => Warranty.detail(req.params.id, req.user)),
  create: (req, res) => handle(res, () => Warranty.create(req.body, req.user), true),
  update: (req, res) => handle(res, () => Warranty.update(req.params.id, req.body, req.user)),
};
