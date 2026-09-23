const Category = require("../models/category.model");

function validateName(body, excludedId = null) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "Category name is required" };
  if (Category.nameExists(name, excludedId))
    return { error: "Category name already exists", status: 409 };
  return { name };
}
function list(req, res) {
  try {
    return res.json({ categories: Category.findAll() });
  } catch (error) {
    console.error("List categories error:", error);
    return res.status(500).json({ message: "Failed to load categories" });
  }
}
function create(req, res) {
  try {
    const result = validateName(req.body);
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    return res.status(201).json({ category: Category.create(result.name) });
  } catch (error) {
    console.error("Create category error:", error);
    return res.status(500).json({ message: "Failed to create category" });
  }
}
function update(req, res) {
  try {
    if (!Category.findById(req.params.id))
      return res.status(404).json({ message: "Category not found" });
    const result = validateName(req.body, req.params.id);
    if (result.error)
      return res.status(result.status || 400).json({ message: result.error });
    return res.json({ category: Category.update(req.params.id, result.name) });
  } catch (error) {
    console.error("Update category error:", error);
    return res.status(500).json({ message: "Failed to update category" });
  }
}
function setStatus(req, res) {
  try {
    const category = Category.setActive(
      req.params.id,
      req.body.is_active === true,
    );
    return category
      ? res.json({ category })
      : res.status(404).json({ message: "Category not found" });
  } catch (error) {
    console.error("Category status error:", error);
    return res
      .status(500)
      .json({ message: "Failed to update category status" });
  }
}
function remove(req, res) {
  try {
    if (!["admin", "manager"].includes(req.user.role))
      return res.status(403).json({ message: "Category deletion requires manager access" });
    const category = Category.remove(req.params.id);
    return category ? res.json({ deleted: true, category }) : res.status(404).json({ message: "Category not found" });
  } catch (error) {
    console.error("Delete category error:", error);
    return res.status(500).json({ message: "Failed to delete category" });
  }
}
module.exports = { list, create, update, setStatus, remove };
