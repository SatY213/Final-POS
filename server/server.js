// Apply a scheduled restore before any route or model opens SQLite.
require("./services/pending-restore").applyPendingRestore();
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = Number(process.env.POS_PORT || 3000);
const authRoutes = require("./routes/auth.routes");
const warehouseRoutes = require("./routes/warehouse.routes");
const cashRegisterRoutes = require("./routes/cash-register.routes");
const userRoutes = require("./routes/user.routes");
const cashSessionRoutes = require("./routes/cash-session.routes");
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const unitRoutes = require("./routes/unit.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const customerRoutes = require("./routes/customer.routes");
const supplierRoutes = require("./routes/supplier.routes");
const settingsRoutes = require("./routes/settings.routes");
const invoiceRoutes = require("./routes/invoices.routes");
const posRoutes = require("./routes/pos.routes");
const salesRoutes = require("./routes/sales.routes");
const quotesRoutes = require("./routes/quotes.routes");
const deliveriesRoutes = require("./routes/deliveries.routes");
const returnsRoutes = require("./routes/returns.routes");
const transactionsRoutes = require("./routes/transactions.routes");
const purchasesRoutes = require("./routes/purchases.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const dataExchangeRoutes = require("./routes/data-exchange.routes");

require("./database/migrations/init");

app.use(cors());
app.use(express.json({ limit: "25mb" }));
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
app.use("/api/customers", customerRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/pos", posRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/quotes", quotesRoutes);
app.use("/api/deliveries", deliveriesRoutes);
app.use("/api/returns", returnsRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/purchases", purchasesRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/data-exchange", dataExchangeRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "POS Modern API is running",
  });
});

// Keep an explicit reference to the HTTP server. This prevents Node from
// completing successfully immediately in the desktop launch environment.
const httpServer = app.listen(PORT, "0.0.0.0", () => {
  console.log(`POS Modern API running on port ${PORT}`, httpServer.address());
});
httpServer.ref();
// Some Electron/Windows launches detach the listening handle after startup.
// This lightweight timer keeps the API process alive; it does no work.
const keepAlive = setInterval(() => {}, 2 ** 31 - 1);
keepAlive.ref();
httpServer.on("error", (error) => {
  console.error("POS API server error", error);
  process.exitCode = 1;
});
