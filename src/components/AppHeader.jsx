import { CircleDot, House, LogOut, Wallet, Warehouse } from "lucide-react";
import logo from "../assets/logo.png";
import { useLanguage } from "../i18n/LanguageContext";

export default function AppHeader({
  session,
  cashSession,
  cashSessionLoading,
  cashSessionError,
  warehouses = [],
  activeWarehouseId,
  warehouseError,
  onWarehouseChange,
  warehouseLocked,
  onCashSessionClick,
  onHome,
  onLogout,
  title,
  subtitle,
  appName,
}) {
  const { t } = useLanguage();
  const userName =
    session?.user?.name ||
    session?.user?.full_name ||
    session?.user?.username ||
    t("user");
  const userRole = session?.user?.role
    ? t(`role_${session.user.role}`)
    : t("user");

  return (
    <header className="flex h-[74px] shrink-0 items-center justify-between border-b border-gray-200 bg-white px-7">
      <div className="flex items-center gap-5">
        <img
          src={logo}
          alt={appName || "MODERNA POS"}
          className="h-[48px] w-auto object-contain"
        />
        <div className="hidden h-7 w-px bg-gray-200 lg:block" />
        <div className="hidden lg:block">
          <p className="text-[13px] font-semibold">{title || appName || t("pointOfSale")}</p>
          <p className="mt-[2px] text-[11px] text-black/50">
            {subtitle || t("readyTransactions")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex h-10 items-center border border-gray-400 bg-white">
          <span className="flex h-full items-center gap-2 border-e border-gray-300 px-3 text-[11px] font-semibold text-black">
            <Warehouse size={15} className="text-[#2563eb]" />
            {t("warehouse")}
          </span>
          <select
            value={activeWarehouseId || ""}
            onChange={(event) => onWarehouseChange(event.target.value)}
            disabled={warehouseLocked || warehouses.length <= 1}
            title={
              warehouseError ||
              (warehouseLocked ? t("warehouseLockedBySession") : t("warehouse"))
            }
            className="h-full max-w-[180px] bg-white px-3 text-[12px] font-semibold text-black outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            {!warehouses.length && (
              <option value="">{t("noAuthorizedWarehouses")}</option>
            )}
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onCashSessionClick}
          disabled={cashSessionLoading || !onCashSessionClick}
          title={cashSessionError || t("cashSession")}
          className={`flex h-10 max-w-[240px] items-center gap-2 border px-3 text-[12px] font-semibold disabled:opacity-50 ${cashSession ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 bg-white text-black"}`}
        >
          {cashSession ? (
            <CircleDot size={15} className="shrink-0" />
          ) : (
            <Wallet size={16} className="shrink-0 text-[#099323]" />
          )}
          <span className="truncate">
            {cashSessionLoading
              ? t("loadingCashSession")
              : cashSession
                ? `${cashSession.cash_register_name} · ${t("open").toUpperCase()}`
                : t("openCashRegister")}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-[#099323]" />
          <span className="hidden text-xs font-medium text-black/55 md:inline">
            {t("online")}
          </span>
        </div>
        <div className="h-7 w-px bg-gray-200" />
        <div className="text-right rtl:text-left">
          <p className="text-[13px] font-semibold leading-tight">{userName}</p>
          <p className="mt-[2px] text-[11px] capitalize text-black/50">
            {userRole}
          </p>
        </div>
        {onHome && (
          <button
            type="button"
            onClick={onHome}
            title={t("home")}
            className="flex h-10 w-10 items-center justify-center border border-gray-300 bg-white"
          >
            <House size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          title={t("logout")}
          className="flex h-10 w-10 items-center justify-center border border-red-300 bg-red-50 text-red-700"
        >
          <LogOut size={18} strokeWidth={1.9} />
        </button>
      </div>
    </header>
  );
}
