const Transactions = require("../services/transaction.service");
exports.list = (req,res) => { try { res.json({ transactions: Transactions.list(req.query, req.user) }); } catch (error) { res.status(error.status || 500).json({ message: error.message || "Transactions unavailable" }); } };
