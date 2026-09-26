const User = require("../models/user.model");
const Session = require("../models/session.model");

const { verifyPassword } = require("../utils/password");

function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required",
    });
  }

  const user = User.findByUsername(username.trim());

  if (!user) {
    return res.status(401).json({
      message: "Invalid username or password",
    });
  }

  if (!user.is_active) {
    return res.status(403).json({
      message: "User account is disabled",
    });
  }

  const validPassword = verifyPassword(password, user.password_hash);

  if (!validPassword) {
    return res.status(401).json({
      success: false,
      message: "Invalid username or password",
      status: 401,
    });
  }

  const token = Session.create(user.id);

  return res.json({
    token,

    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      full_name: user.name,
      role: user.role,
      warehouse_id: user.warehouse_id,
    },
  });
}

function logout(req, res) {
  Session.remove(req.token);

  return res.json({
    success: true,
    message: "Logged out",
    status: 200,
  });
}

function me(req, res) {
  return res.json({
    user: req.user,
  });
}

module.exports = {
  login,
  logout,
  me,
};
