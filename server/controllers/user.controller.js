const User = require("../models/user.model");
const CashRegister = require("../models/cash-register.model");
const { hashPassword } = require("../utils/password");

const roles = new Set(["admin", "manager", "cashier", "stock"]);

function publicUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function validate(body, excludedId = null) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" ? body.role.toLowerCase() : "";
  const warehouseId =
    body.warehouse_id === null ||
    body.warehouse_id === "" ||
    body.warehouse_id === undefined
      ? null
      : Number(body.warehouse_id);
  if (!name) return { error: "Name is required" };
  if (!username) return { error: "Username is required" };
  if ((!excludedId || password) && password.length < 6)
    return { error: "Password must contain at least 6 characters" };
  if (!roles.has(role)) return { error: "Invalid user role" };
  if (
    warehouseId !== null &&
    (!Number.isInteger(warehouseId) || warehouseId < 1)
  )
    return { error: "Invalid warehouse" };
  if (warehouseId !== null && !CashRegister.warehouseExists(warehouseId))
    return { error: "Warehouse not found" };
  if (User.usernameExists(username, excludedId))
    return { error: "Username already exists", status: 409 };
  return {
    value: {
      name,
      username,
      role,
      warehouse_id: warehouseId,
      is_active: body.is_active !== false,
      password_hash: password ? hashPassword(password) : null,
    },
  };
}

function getUsers(req, res) {
  try {
    return res.json({ users: User.findAll().map(publicUser) });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ message: "Failed to load users" });
  }
}
function getUserById(req, res) {
  try {
    const user = User.findById(req.params.id);
    return user
      ? res.json({ user: publicUser(user) })
      : res.status(404).json({ message: "User not found" });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({ message: "Failed to load user" });
  }
}
function createUser(req, res) {
  try {
    const result = validate(req.body);
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    return res
      .status(201)
      .json({ user: publicUser(User.create(result.value)) });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({ message: "Failed to create user" });
  }
}
function updateUser(req, res) {
  try {
    if (!User.findById(req.params.id))
      return res.status(404).json({ message: "User not found" });
    const result = validate(req.body, req.params.id);
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    return res.json({
      user: publicUser(User.update(req.params.id, result.value)),
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({ message: "Failed to update user" });
  }
}

module.exports = { getUsers, getUserById, createUser, updateUser };
