const Session = require("../models/session.model");
const db = require("../config/database");

function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({
      message: "Invalid authentication token",
    });
  }

  const session = Session.findByToken(token);

  if (!session || !session.is_active) {
    return res.status(401).json({
      message: "Session is invalid",
    });
  }

  req.token = token;

  req.user = {
    id: session.user_id,
    username: session.username,
    name: session.name,
    full_name: session.name,
    role: session.role,
    warehouse_id: session.warehouse_id,
    warehouse_ids: db.prepare("SELECT warehouse_id FROM user_warehouses WHERE user_id=?").all(session.user_id).map((row) => row.warehouse_id),
  };

  next();
}

module.exports = authMiddleware;
