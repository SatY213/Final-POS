const Exchange = require("../services/data-exchange.service");
function handle(res, action) { try { return action(); } catch (error) { console.error("Data exchange error", error); return res.status(error.status || 500).json({ message: error.message || "Data exchange failed", details: error.details }); } }
exports.template = (req, res) => handle(res, () => { const content = Exchange.template(req.params.entity, req.user); res.type("text/csv").attachment(`modele-${req.params.entity}.csv`).send(`\ufeff${content}`); });
exports.preview = (req, res) => handle(res, () => res.json({ preview: Exchange.preview(req.params.entity, req.body.content, req.user) }));
exports.commit = (req, res) => handle(res, () => res.status(201).json({ summary: Exchange.commit(req.params.entity, req.body.content, req.body.duplicate_policy || "error", req.user) }));
exports.exportCsv = (req, res) => handle(res, () => { const content = Exchange.exportCsv(req.params.entity, req.query, req.user); res.type("text/csv").attachment(`export-${req.params.entity}.csv`).send(`\ufeff${content}`); });
