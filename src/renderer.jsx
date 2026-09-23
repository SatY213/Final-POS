import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import Settings from "./pages/Settings/Settings";
import Products from "./pages/Products/Products";
import Stock from "./pages/Stock/Stock";
import Customers from "./pages/Customers/Customers";
import Suppliers from "./pages/Suppliers/Suppliers";
import CashRegister from "./pages/CashRegister/CashRegister";
import PointOfSale from "./pages/PointOfSale/PointOfSale";
import Sales from "./pages/Sales/Sales";
import Quotes from "./pages/Quotes/Quotes";
import Deliveries from "./pages/Deliveries/Deliveries";
import InvoiceBuilder from "./pages/Invoices/InvoiceBuilder";
import Transactions from "./pages/Transactions/Transactions";
import Purchases from "./pages/Purchases/Purchases";
import PurchaseOrders from "./pages/Purchases/PurchaseOrders";
import PointOfPurchase from "./pages/PointOfPurchase/PointOfPurchase";
import Reports from "./pages/Reports/Reports";

import "./index.css";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import { apiGet, AUTH_EXPIRED_EVENT } from "./api/client";
import { getCurrentCashSession } from "./api/cash-session.model";
import { getProductWarehouses } from "./api/product.model";
import AppLayout from "./layouts/AppLayout";
import { getSettings } from "./api/settings.model";
import { setRuntimeSettings } from "./utils/runtimeSettings";
import {
  clearStoredSession,
  getAuthToken,
  getStoredSession,
  setStoredSession,
} from "./utils/session";

function App() {
  const { t } = useLanguage();
  const [session, setSession] = useState(getStoredSession);
  const [sessionVerified, setSessionVerified] = useState(() => !getStoredSession());
  const [sessionConnectionError, setSessionConnectionError] = useState(false);

  const [currentPage, setCurrentPage] = useState("dashboard");
  const [navigationData, setNavigationData] = useState(null);
  const [cashSession, setCashSession] = useState(null);
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const [cashSessionError, setCashSessionError] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [activeWarehouseId, setActiveWarehouseId] = useState("");
  const [warehouseError, setWarehouseError] = useState("");
  const [generalSettings, setGeneralSettings] = useState(null);

  useEffect(() => {
    const onExpired = () => handleLogout();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    const saved = getStoredSession();
    if (!saved) return;
    if (!saved.token) {
      handleLogout();
      return;
    }
    let active = true;
    let retryTimer;
    const verify = () => apiGet("/api/auth/me")
      .then(({ user }) => {
        if (!active || getAuthToken() !== saved.token) return;
        const verified = { ...saved, user };
        setStoredSession(verified);
        setSession(verified);
        setSessionConnectionError(false);
        setSessionVerified(true);
      })
      .catch((error) => {
        // An unavailable API must not discard a persisted session. A genuine
        // 401 is handled by the shared client and sends the user to login.
        if (!active || error.status === 401) return;
        setSessionConnectionError(true);
        retryTimer = window.setTimeout(verify, 2000);
      });
    verify();
    return () => {
      active = false;
      window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (!session || !sessionVerified) return;
    window.electronAPI?.openMainWindow?.();
    loadApplicationContext();
  }, [session, sessionVerified]);

  async function loadApplicationContext() {
    try {
      setCashSessionLoading(true);
      setCashSessionError("");
      setWarehouseError("");
      const [currentCashSession, authorizedWarehouses, preferences] = await Promise.all([
        getCurrentCashSession(),
        getProductWarehouses(),
        getSettings("general"),
      ]);
      setCashSession(currentCashSession);
      setWarehouses(authorizedWarehouses);
      setGeneralSettings(preferences);
      setRuntimeSettings(preferences);
      document.title = preferences.application_name || "MODERNA POS";

      const persistedId = Number(
        localStorage.getItem(`pos_active_warehouse_${session.user.id}`),
      );
      const assignedId = Number(session.user.warehouse_id);
      const defaultId = Number(preferences.default_warehouse_id);
      const validIds = new Set(
        authorizedWarehouses.map((warehouse) => Number(warehouse.id)),
      );
      const nextWarehouseId =
        currentCashSession?.warehouse_id &&
        validIds.has(Number(currentCashSession.warehouse_id))
          ? Number(currentCashSession.warehouse_id)
          : validIds.has(persistedId)
            ? persistedId
            : validIds.has(defaultId)
              ? defaultId
            : validIds.has(assignedId)
              ? assignedId
              : authorizedWarehouses[0]?.id || "";
      setActiveWarehouseId(nextWarehouseId ? String(nextWarehouseId) : "");
      if (nextWarehouseId)
        localStorage.setItem(
          `pos_active_warehouse_${session.user.id}`,
          String(nextWarehouseId),
        );
      if (!authorizedWarehouses.length)
        setWarehouseError("No active warehouse is available for this account");
    } catch (error) {
      const message = error.message || "Failed to load application context";
      setCashSessionError(message);
      setWarehouseError(message);
    } finally {
      setCashSessionLoading(false);
    }
  }

  function handleWarehouseChange(warehouseId) {
    if (
      !warehouses.some(
        (warehouse) => Number(warehouse.id) === Number(warehouseId),
      )
    )
      return;
    setActiveWarehouseId(String(warehouseId));
    localStorage.setItem(
      `pos_active_warehouse_${session.user.id}`,
      String(warehouseId),
    );
  }

  function handleCashSessionChange(nextCashSession) {
    setCashSession(nextCashSession);
    if (nextCashSession?.warehouse_id) {
      const warehouseId = String(nextCashSession.warehouse_id);
      setActiveWarehouseId(warehouseId);
      localStorage.setItem(
        `pos_active_warehouse_${session.user.id}`,
        warehouseId,
      );
    }
  }

  function handleLogin(data) {
    setStoredSession(data);
    setSession(data);
    setSessionVerified(true);
    setSessionConnectionError(false);
    setCurrentPage("dashboard");
  }

  function handleLogout() {
    clearStoredSession();
    setSession(null);
    setSessionVerified(false);
    setSessionConnectionError(false);
    setNavigationData(null);
    setCashSession(null);
    setCashSessionLoading(false);
    setCashSessionError("");
    setWarehouses([]);
    setActiveWarehouseId("");
    setWarehouseError("");
    setGeneralSettings(null);
    setCurrentPage("dashboard");

    window.electronAPI?.closeMainWindow?.();
  }

  function handleNavigate(page, data = null) {
    setCurrentPage(page);
    setNavigationData(data);
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }
  if (!sessionVerified) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-black/60">{t(sessionConnectionError ? "serverUnavailableRetrying" : "loading")}</div>;
  }

  const activeCashSession =
    Number(cashSession?.warehouse_id) === Number(activeWarehouseId)
      ? cashSession
      : null;
  const currentModule =
    currentPage === "products" ? (
      <Products
        session={session}
        warehouseId={activeWarehouseId}
        warehouses={warehouses}
        warehouseError={warehouseError}
        onNavigate={handleNavigate}
      />
    ) : currentPage === "inventory" ? (
      <Stock
        warehouseId={activeWarehouseId}
        warehouses={warehouses}
        warehouseError={warehouseError}
        initialFilters={navigationData}
      />
    ) : currentPage === "customers" ? (
      <Customers session={session} />
    ) : currentPage === "suppliers" ? (
      <Suppliers session={session} />
    ) : ["cash-session", "cash-register"].includes(currentPage) ? (
      <CashRegister
        session={session}
        cashSession={activeCashSession}
        warehouseId={activeWarehouseId}
        onCashSessionChange={handleCashSessionChange}
      />
    ) : currentPage === "pos" ? (
      <PointOfSale
        session={session}
        warehouseId={activeWarehouseId}
        cashSession={activeCashSession}
        onNavigate={handleNavigate}
        onSaleFinalized={loadApplicationContext}
        initialQuote={navigationData?.quote || null}
        initialQuoteEdit={!!navigationData?.editQuote}
        initialMode={navigationData?.mode || "SALE"}
        initialDocumentType={navigationData?.documentType}
        initialReturnSale={navigationData?.returnSale || null}
        initialEditSale={navigationData?.editSale || null}
      />
    ) : currentPage === "sales" ? (
      <Sales
        warehouseId={activeWarehouseId}
        onNavigate={handleNavigate}
        session={session}
        initialFilters={navigationData}
      />
    ) : currentPage === "transactions" ? (
      <Transactions onNavigate={handleNavigate} warehouseId={activeWarehouseId} initialFilters={navigationData} />
    ) : currentPage === "purchases" ? (
      <Purchases warehouseId={activeWarehouseId} onNavigate={handleNavigate} initialFilters={navigationData} onReceiptFinalized={loadApplicationContext} />
    ) : currentPage === "purchase-orders" ? (
      <PurchaseOrders warehouseId={activeWarehouseId} onNavigate={handleNavigate} />
    ) : currentPage === "pop" ? (
      <PointOfPurchase warehouseId={activeWarehouseId} initialOrder={navigationData?.order || null} initialEditReceipt={navigationData?.editReceipt || null} onNavigate={handleNavigate} onReceiptFinalized={loadApplicationContext} />
    ) : currentPage === "invoice-builder" ? (
      <InvoiceBuilder
        warehouseId={activeWarehouseId}
        initialSaleId={navigationData?.saleId}
        invoiceId={navigationData?.invoiceId}
        openPayment={!!navigationData?.openPayment}
        onNavigate={handleNavigate}
      />
    ) : currentPage === "quotes" ? (
      <Quotes warehouseId={activeWarehouseId} onNavigate={handleNavigate} />
    ) : currentPage === "deliveries" ? (
      <Deliveries warehouseId={activeWarehouseId} />
    ) : currentPage === "settings" ? (
      <Settings onNavigate={handleNavigate} />
    ) : currentPage === "reports" ? (
      <Reports warehouseId={activeWarehouseId} onNavigate={handleNavigate} />
    ) : (
      <Dashboard cashSession={activeCashSession} warehouseId={activeWarehouseId} onNavigate={handleNavigate} />
    );

  return (
    <AppLayout
      session={session}
      cashSession={activeCashSession}
      cashSessionLoading={cashSessionLoading}
      cashSessionError={cashSessionError}
      warehouses={warehouses}
      activeWarehouseId={activeWarehouseId}
      warehouseError={warehouseError}
      onWarehouseChange={handleWarehouseChange}
      showHome={currentPage !== "dashboard"}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      title={
        currentPage === "invoice-builder"
          ? navigationData?.invoiceId
            ? t("Modifier la facture")
            : "Facturation"
          : undefined
      }
      subtitle={
        currentPage === "invoice-builder"
          ? navigationData?.invoiceId
            ? "Modifier les informations, articles et paiements"
            : "Créer une facture à partir de plusieurs ventes"
          : undefined
      }
      appName={generalSettings?.application_name}
    >
      {currentModule}
    </AppLayout>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>,
);
