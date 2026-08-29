const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;
const authRoutes = require("./routes/auth.routes");
const warehouseRoutes = require("./routes/warehouse.routes");
const cashRegisterRoutes = require("./routes/cash-register.routes");
const userRoutes = require("./routes/user.routes");
const cashSessionRoutes = require("./routes/cash-session.routes");
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const unitRoutes = require("./routes/unit.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const supplierRoutes = require("./routes/supplier.routes");
const customerRoutes = require("./routes/customer.routes");

require("./database/migrations/init");

app.use(cors());
app.use(express.json());
// routes
app.use("/api/auth", authRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/cash-registers", cashRegisterRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cash-sessions", cashSessionRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/customers", customerRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "POS Modern API is running",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`POS Modern API running on port ${PORT}`);
});
