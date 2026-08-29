import AppHeader from "../components/AppHeader";

export default function AppLayout({ children, session, cashSession, cashSessionLoading, cashSessionError, warehouses, activeWarehouseId, warehouseError, onWarehouseChange, showHome = false, onNavigate, onLogout }) {
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
      warehouseLocked={Boolean(cashSession)}
      onCashSessionClick={() => onNavigate("cash-session")}
      onHome={showHome ? () => onNavigate("dashboard") : null}
      onLogout={onLogout}
    />
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>;
}
