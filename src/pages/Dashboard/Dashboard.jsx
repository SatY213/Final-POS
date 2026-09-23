import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, BarChart3, Boxes, FileText, Package,
  ReceiptText, Search, Settings, ShoppingCart, TrendingUp, Users, Wallet,
} from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import ModuleCard from "../../components/ModuleCard";
import ErrorMessage from "../../components/ui/ErrorMessage";
import { getDashboardData } from "../../api/analytics.model";
import { formatDateTime, formatMoney } from "../../utils/formatters";

const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
};

const quickModules = [
  { key: "sales", icon: ReceiptText, bg: "bg-[#e8f7eb]", color: "text-[#099323]" },
  { key: "quotes", icon: FileText, bg: "bg-[#eef5ff]", color: "text-[#2563eb]" },
  { key: "products", icon: Package, bg: "bg-[#eef5ff]", color: "text-[#2563eb]" },
  { key: "inventory", icon: Boxes, bg: "bg-[#fff4df]", color: "text-[#b86e00]" },
  { key: "purchases", icon: ShoppingCart, bg: "bg-[#fff4df]", color: "text-[#b86e00]" },
  { key: "customers", icon: Users, bg: "bg-[#eef0ff]", color: "text-[#4f46e5]" },
  { key: "suppliers", icon: Users, bg: "bg-[#fff4df]", color: "text-[#b86e00]" },
  { key: "transactions", icon: ReceiptText, bg: "bg-[#eef5ff]", color: "text-[#2563eb]" },
  { key: "reports", icon: BarChart3, bg: "bg-[#f2ecff]", color: "text-[#7c3aed]" },
  { key: "settings", icon: Settings, bg: "bg-[#eeeeee]", color: "text-black" },
  { key: "cashRegisterModule", page: "cash-register", icon: Wallet, bg: "bg-[#e8f7eb]", color: "text-[#087c1e]" },
];

export default function Dashboard({ cashSession, warehouseId, onNavigate }) {
  const { t, language } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!warehouseId) return;
    let active = true;
    setLoading(true);
    setError("");
    const today = localDate();
    getDashboardData({ warehouse_id: warehouseId, start: today, end: today })
      .then((result) => active && setData(result))
      .catch((reason) => active && setError(reason.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [warehouseId]);

  const navigate = (page, filters) => onNavigate?.(page, filters || null);
  const overview = data?.overview || {};
  const alerts = data?.alerts || [];
  const recent = data?.recent_activity || [];
  return <div className="flex h-full flex-col overflow-hidden bg-[#f5f7f5] text-black">
    <ErrorMessage message={error} onClose={() => setError("")} />
    <main className="flex-1 overflow-auto"><div className="mx-auto max-w-[1500px] px-7 py-5">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <button type="button" onClick={() => navigate(cashSession ? "pos" : "cash-register")} className="flex min-h-[170px] items-center justify-between border border-[#087c1e] bg-[#099323] px-7 text-left text-white">
          <div className="flex items-center gap-6"><div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center bg-white/15"><ShoppingCart size={34}/></div><div><p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-white/75">{t("newTransaction")}</p><h1 className="mt-2 text-[30px] font-bold tracking-tight">{t("startSale")}</h1><p className="mt-2 text-sm text-white/80">{t("scanCheckout")}</p></div></div><ArrowRight size={30}/>
        </button>
        <div className="flex min-h-[170px] flex-col border border-gray-300 bg-white p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center bg-[#eef5ff] text-[#2563eb]"><Search size={20}/></div><div><h2 className="text-[15px] font-semibold">{t("quickProductSearch")}</h2><p className="mt-[2px] text-[11px] text-black/50">{t("productSearchDescription")}</p></div></div><button type="button" onClick={() => navigate("products")} className="mt-auto flex h-12 items-center justify-between border border-gray-400 px-4 text-left text-sm text-black/50 hover:bg-gray-50"><span>{t("searchProduct")}</span><Search size={18}/></button></div>
      </section>
      <section className="mt-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold">{t("quickAccess")}</h2><p className="text-[11px] text-black/45">{t("openModule")}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">{quickModules.map((item) => <ModuleCard key={item.key} icon={item.icon} title={t(item.key)} tone={item} onClick={() => navigate(item.page || item.key)}/>)}</div></section>
      <section className="mt-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-semibold">{t("today")}</h2>{loading && <span className="text-[11px] text-black/45">{t("loading")}</span>}</div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoCard title={t("revenue")} value={formatMoney(overview.revenue)} icon={TrendingUp} iconBg="bg-[#e8f7eb]" iconColor="text-[#099323]" onClick={() => navigate("sales", { period: "today" })}/>
        <InfoCard title={t("transactions")} value={overview.transaction_count || 0} icon={ReceiptText} iconBg="bg-[#eef5ff]" iconColor="text-[#2563eb]" onClick={() => navigate("transactions", { period: "today" })}/>
        <InfoCard title={t("paymentsReceived")} value={formatMoney(overview.payments_received)} icon={Wallet} iconBg="bg-[#eef0ff]" iconColor="text-[#4f46e5]" onClick={() => navigate("transactions", { direction: "IN" })}/>
        <InfoCard title={t("lowStock")} value={overview.low_stock_count || 0} icon={AlertTriangle} iconBg="bg-[#fff4df]" iconColor="text-[#b86e00]" onClick={() => navigate("inventory", { stock_status: "attention" })}/>
      </div></section>
      <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="border border-gray-300 bg-white"><div className="flex h-[52px] items-center justify-between border-b border-gray-200 px-5"><h2 className="text-[14px] font-semibold">{t("recentActivity")}</h2><button onClick={() => navigate("transactions")} className="text-xs font-semibold text-[#099323]">{t("viewTransactions")}</button></div>{recent.length ? <div className="divide-y divide-gray-200">{recent.map((item) => <button key={item.id} type="button" onClick={() => navigate("transactions", { search: item.reference })} className="grid min-h-[52px] w-full grid-cols-[1fr_1fr_auto] items-center gap-3 px-5 text-left hover:bg-gray-50"><div><b className="text-[12px]">{item.reference}</b><p className="text-[10px] text-black/45">{item.partner_name}</p></div><div><span className="text-[11px]">{t(`transaction_${item.source_type}`)}</span><p className="text-[10px] text-black/45">{formatDateTime(item.created_at, language)}</p></div><b className={item.direction === "IN" ? "text-[12px] text-green-700" : "text-[12px] text-red-700"}>{item.direction === "IN" ? "+" : "-"}{formatMoney(item.amount)}</b></button>)}</div> : <Empty icon={ReceiptText} title={t("noTransactions")} description={t("salesAppear")}/>}</div>
        <div className="border border-gray-300 bg-white"><div className="flex h-[52px] items-center justify-between border-b border-gray-200 px-5"><h2 className="text-[14px] font-semibold">{t("attention")}</h2><span className={`flex items-center gap-2 text-[11px] font-semibold ${alerts.length ? "text-amber-700" : "text-[#099323]"}`}><span className={`h-2 w-2 ${alerts.length ? "bg-amber-500" : "bg-[#099323]"}`}/>{alerts.length ? `${alerts.length} ${t("alerts")}` : t("allGood")}</span></div>{alerts.length ? <div className="max-h-[260px] divide-y divide-gray-200 overflow-auto">{alerts.map((item, index) => <button type="button" key={`${item.type}:${index}`} onClick={() => navigate(item.target, item.filters || { stock_status: item.filter })} className="flex min-h-[52px] w-full items-center gap-3 px-5 text-left hover:bg-gray-50"><AlertTriangle size={17} className={item.severity === "error" ? "text-red-600" : "text-amber-600"}/><div className="min-w-0 flex-1"><b className="block truncate text-[11px]">{item.label || formatMoney(item.value)}</b><span className="text-[10px] text-black/45">{t(`alert_${item.type}`)}</span></div><ArrowRight size={14}/></button>)}</div> : <Empty icon={Boxes} title={t("stockHealthy")} description={t("noStockAlerts")} good/>}</div>
      </section>
    </div></main>
  </div>;
}

function InfoCard({ title, value, icon: Icon, iconBg, iconColor, onClick }) {
  return <button type="button" onClick={onClick} className="flex min-h-[92px] items-center justify-between border border-gray-300 bg-white px-5 text-left hover:border-gray-500"><div><p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-black/45">{title}</p><p className="mt-2 text-[21px] font-bold tracking-tight text-black">{value}</p></div><div className={`flex h-10 w-10 items-center justify-center ${iconBg} ${iconColor}`}><Icon size={20}/></div></button>;
}

function Empty({ icon: Icon, title, description, good = false }) {
  return <div className="flex h-[156px] items-center justify-center text-center"><div><div className={`mx-auto flex h-10 w-10 items-center justify-center ${good ? "bg-[#e8f7eb] text-[#099323]" : "bg-gray-100 text-black/45"}`}><Icon size={19}/></div><p className="mt-3 text-[13px] font-semibold">{title}</p><p className="mt-1 text-[11px] text-black/45">{description}</p></div></div>;
}
