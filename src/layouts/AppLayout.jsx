import AppHeader from "../components/AppHeader";

export default function AppLayout({ children, session, cashSession, cashSessionLoading, cashSessionError, warehouses, activeWarehouseId, warehouseError, onWarehouseChange, showHome = false, onNavigate, onLogout, title, subtitle, appName }) {
  return <div className="flex h-screen flex-col overflow-hidden bg-[#f5f7f5] text-black">
    <AppHeader
      session={session}
      cashSession={cashSession}
      cashSessionLoading={cashSessionLoading}
      cashSessionError={cashSessionError}
      warehouses={warehouses}
      activeWarehouseId={activeWarehouseId}
      warehouseError={warehouseError}
      onWarehouseChange={onWarehouseChange}
      warehouseLocked={false}
      onCashSessionClick={() => onNavigate("cash-session")}
      onHome={showHome ? () => onNavigate("dashboard") : null}
      onLogout={onLogout}
      title={title}
      subtitle={subtitle}
      appName={appName}
    />
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>;
}
