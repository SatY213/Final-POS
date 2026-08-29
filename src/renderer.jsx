import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import Settings from "./pages/Settings/Settings";
import Products from "./pages/Products/Products";
import Stock from "./pages/Stock/Stock";
import Suppliers from "./pages/Suppliers/Suppliers";
import Customers from "./pages/Customers/Customers";
import CashRegister from "./pages/CashRegister/CashRegister";

import "./index.css";
import { LanguageProvider } from "./i18n/LanguageContext";
import { getCurrentCashSession } from "./api/cash-session.model";
import { getProductWarehouses } from "./api/product.model";
import AppLayout from "./layouts/AppLayout";

function App() {
  const [session, setSession] = useState(() => {
    const savedSession = localStorage.getItem("pos_session");

    if (!savedSession) {
      return null;
    }

    try {
      return JSON.parse(savedSession);
    } catch {
      return null;
    }
  });

  const [currentPage, setCurrentPage] = useState("dashboard");
  const [cashSession, setCashSession] = useState(null);
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const [cashSessionError, setCashSessionError] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [activeWarehouseId, setActiveWarehouseId] = useState("");
  const [warehouseError, setWarehouseError] = useState("");

  useEffect(() => {
    if (session) {
      window.electronAPI.openMainWindow();
      loadApplicationContext();
    }
  }, [session]);

  async function loadApplicationContext() {
    try {
      setCashSessionLoading(true);
      setCashSessionError("");
      setWarehouseError("");
      const [currentCashSession, authorizedWarehouses] = await Promise.all([
        getCurrentCashSession(),
        getProductWarehouses(),
      ]);
      setCashSession(currentCashSession);
      setWarehouses(authorizedWarehouses);

      const persistedId = Number(localStorage.getItem(`pos_active_warehouse_${session.user.id}`));
      const assignedId = Number(session.user.warehouse_id);
      const validIds = new Set(authorizedWarehouses.map((warehouse) => Number(warehouse.id)));
      const nextWarehouseId = currentCashSession?.warehouse_id && validIds.has(Number(currentCashSession.warehouse_id))
        ? Number(currentCashSession.warehouse_id)
        : validIds.has(persistedId)
          ? persistedId
          : validIds.has(assignedId)
            ? assignedId
            : authorizedWarehouses[0]?.id || "";
      setActiveWarehouseId(nextWarehouseId ? String(nextWarehouseId) : "");
      if (nextWarehouseId) localStorage.setItem(`pos_active_warehouse_${session.user.id}`, String(nextWarehouseId));
      if (!authorizedWarehouses.length) setWarehouseError("No active warehouse is available for this account");
    } catch (error) {
      const message = error.message || "Failed to load application context";
      setCashSessionError(message);
      setWarehouseError(message);
    } finally {
      setCashSessionLoading(false);
    }
  }

  function handleWarehouseChange(warehouseId) {
    if (cashSession || !warehouses.some((warehouse) => Number(warehouse.id) === Number(warehouseId))) return;
    setActiveWarehouseId(String(warehouseId));
    localStorage.setItem(`pos_active_warehouse_${session.user.id}`, String(warehouseId));
  }

  function handleCashSessionChange(nextCashSession) {
    setCashSession(nextCashSession);
    if (nextCashSession?.warehouse_id) {
      const warehouseId = String(nextCashSession.warehouse_id);
      setActiveWarehouseId(warehouseId);
      localStorage.setItem(`pos_active_warehouse_${session.user.id}`, warehouseId);
    }
  }

  function handleLogin(data) {
    localStorage.setItem("pos_session", JSON.stringify(data));
    setSession(data);
    setCurrentPage("dashboard");
  }

  function handleLogout() {
    localStorage.removeItem("pos_session");
    setSession(null);
    setCashSession(null);
    setWarehouses([]);
    setActiveWarehouseId("");
    setCurrentPage("dashboard");

    window.electronAPI.closeMainWindow();
  }

  function handleNavigate(page) {
    setCurrentPage(page);
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  const currentModule = currentPage === "products"
    ? <Products warehouseId={activeWarehouseId} warehouses={warehouses} warehouseError={warehouseError} onNavigate={handleNavigate} />
    : currentPage === "inventory"
      ? <Stock warehouseId={activeWarehouseId} warehouses={warehouses} warehouseError={warehouseError} />
    : currentPage === "suppliers"
      ? <Suppliers session={session} />
    : currentPage === "customers"
      ? <Customers session={session} />
    : ["cash-session", "cash-register"].includes(currentPage)
      ? <CashRegister session={session} cashSession={cashSession} warehouseId={activeWarehouseId} onCashSessionChange={handleCashSessionChange} />
    : currentPage === "settings"
      ? <Settings onNavigate={handleNavigate} />
      : <Dashboard cashSession={cashSession} onNavigate={handleNavigate} />;

  return <AppLayout session={session} cashSession={cashSession} cashSessionLoading={cashSessionLoading} cashSessionError={cashSessionError} warehouses={warehouses} activeWarehouseId={activeWarehouseId} warehouseError={warehouseError} onWarehouseChange={handleWarehouseChange} showHome={currentPage !== "dashboard"} onNavigate={handleNavigate} onLogout={handleLogout}>
    {currentModule}
  </AppLayout>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>,
);
