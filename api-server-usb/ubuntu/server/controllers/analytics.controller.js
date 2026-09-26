const Analytics = require("../services/analytics.service");

function handle(res, action) {
  try {
    return res.json(action());
  } catch (error) {
    console.error("Analytics error", error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Reporting data is unavailable",
    });
  }
}

exports.dashboard = (req, res) =>
  handle(res, () => Analytics.dashboard(req.query, req.user));
exports.report = (req, res) =>
  handle(res, () => Analytics.report(req.query, req.user));
