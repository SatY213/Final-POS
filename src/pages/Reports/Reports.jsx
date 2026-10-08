import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { getReportData } from "../../api/analytics.model";
import { exportData } from "../../api/data-exchange.model";
import { getCustomers } from "../../api/customer.model";
import { getSuppliers } from "../../api/supplier.model";
import ErrorMessage from "../../components/ui/ErrorMessage";
import { formatMoney, formatQuantity } from "../../utils/formatters";
import { useLanguage } from "../../i18n/LanguageContext";

const categories = ["overview", "sales", "purchases", "customers", "suppliers", "stock", "finance"];
const today = () => new Date().toISOString().slice(0, 10);
function startFor(preset) {
  const date = new Date();
  if (preset === "week") date.setDate(date.getDate() - 6);
  if (preset === "month") date.setDate(1);
  if (preset === "year") date.setMonth(0, 1);
  return date.toISOString().slice(0, 10);
}

export default function Reports({ warehouseId, onNavigate }) {
  const { t } = useLanguage();
  const [category, setCategory] = useState("overview");
  const [preset, setPreset] = useState("month");
  const [start, setStart] = useState(startFor("month"));
  const [end, setEnd] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const query = useMemo(() => ({
    category,
    start,
    end,
    warehouse_id: warehouseId,
    customer_id: ["sales", "customers"].includes(category) ? customerId : "",
    supplier_id: ["purchases", "suppliers"].includes(category) ? supplierId : "",
  }), [category, start, end, warehouseId, customerId, supplierId]);

  useEffect(() => {
    Promise.all([
      getCustomers({ page: 1, limit: 100, status: "active" }),
      getSuppliers({ page: 1, limit: 100, status: "active" }),
    ]).then(([customerData, supplierData]) => {
      setCustomers(customerData.customers || []);
      setSuppliers(supplierData.suppliers || []);
    }).catch((reason) => setError(reason.message));
  }, []);

  function load() {
    if (!warehouseId) return;
    setLoading(true);
    setError("");
    getReportData(query).then(setData).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }
  useEffect(load, [query]);
  function choosePreset(value) {
    setPreset(value);
    if (value !== "custom") {
      setStart(startFor(value));
      setEnd(today());
    }
  }
  async function exportCsv() {
    if (!data) return;
    try {
      await exportData("report", query);
    } catch (reason) {
      setError(reason.message);
    }
  }
  const o = data?.overview || {};
  return <div className="flex h-full min-h-0 flex-col bg-[#f5f7f5] p-4 lg:p-5">
    <ErrorMessage message={error} onClose={() => setError("")} />
    <section className="flex h-full min-h-0 w-full flex-col border border-gray-300 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center bg-purple-50 text-purple-700"><BarChart3 size={20}/></div>
        <div><h1 className="text-[18px] font-black">{t("reports")}</h1><p className="text-[11px] text-black/50">{t("reportsDescription")}</p></div>
        <button onClick={exportCsv} disabled={!data} className="ml-auto inline-flex h-9 items-center gap-2 border border-gray-400 px-3 text-[11px] font-semibold disabled:opacity-40"><Download size={15}/>{t("exportCsv")}</button>
        <button onClick={load} disabled={loading} className="inline-flex h-9 items-center gap-2 border border-gray-400 px-3 text-[11px] font-semibold"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/>{t("refresh")}</button>
      </header>
      <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-4 py-3">
        {["today", "week", "month", "year", "custom"].map((item) => <button key={item} onClick={() => choosePreset(item)} className={`h-8 border px-3 text-[11px] font-semibold ${preset === item ? "border-[#099323] bg-green-50 text-[#087c1e]" : "border-gray-300 bg-white"}`}>{t(`period_${item}`)}</button>)}
        {["sales", "customers"].includes(category) && <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="h-8 min-w-44 border border-gray-400 bg-white px-2 text-[11px]"><option value="">{t("allCustomers")}</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        {["purchases", "suppliers"].includes(category) && <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="h-8 min-w-44 border border-gray-400 bg-white px-2 text-[11px]"><option value="">{t("allSuppliers")}</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        <div className="ml-auto flex items-center gap-2"><input type="date" value={start} onChange={(e) => { setPreset("custom"); setStart(e.target.value); }} className="h-8 border border-gray-400 px-2 text-[11px]"/><span className="text-[11px]">—</span><input type="date" value={end} onChange={(e) => { setPreset("custom"); setEnd(e.target.value); }} className="h-8 border border-gray-400 px-2 text-[11px]"/></div>
      </div>
      <nav className="flex border-b px-4">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`h-11 border-b-2 px-4 text-[12px] font-semibold ${category === item ? "border-[#099323] text-[#087c1e]" : "border-transparent text-black/55"}`}>{t(`report_${item}`)}</button>)}</nav>
      <main className="min-h-0 flex-1 overflow-auto bg-[#f5f7f5] p-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Kpi label={t("revenue")} value={formatMoney(o.revenue)} />
          <Kpi label={t("salesCount")} value={o.sales_count || 0} />
          <Kpi label={t("averageBasket")} value={formatMoney(o.average_basket)} />
          <Kpi label={t("paymentsReceived")} value={formatMoney(o.payments_received)} />
          <Kpi label={t("customerReceivable")} value={formatMoney(o.customer_receivable)} warning={o.customer_receivable > 0} onClick={() => onNavigate?.("sales", { payment_status: "UNPAID" })}/>
          <Kpi label={t("purchases")} value={formatMoney(o.purchases)} />
          <Kpi label={t("supplierPayable")} value={formatMoney(o.supplier_payable)} warning={o.supplier_payable > 0} onClick={() => onNavigate?.("purchases", { payment_status: "UNPAID" })}/>
          <Kpi label={t("returns")} value={formatMoney(Number(o.customer_returns || 0) + Number(o.supplier_returns || 0))} />
          <Kpi label={t("cashIn")} value={formatMoney(o.cash_in)} />
          <Kpi label={t("netCash")} value={formatMoney(o.net_cash)} warning={o.net_cash < 0}/>
        </div>
        <ReportSections category={category} data={data} t={t}/>
      </main>
    </section>
  </div>;
}

function Kpi({ label, value, warning, onClick }) {
  const Tag = onClick ? "button" : "div";
  return <Tag onClick={onClick} className={`min-h-[82px] border bg-white px-4 py-3 text-left ${warning ? "border-amber-300" : "border-gray-300"}`}><span className="text-[10px] font-bold uppercase tracking-wide text-black/45">{label}</span><b className="mt-2 block text-[18px]">{value}</b></Tag>;
}

function ReportSections({ category, data, t }) {
  if (!data) return <div className="mt-4 border border-gray-300 bg-white p-12 text-center text-[12px] text-black/40">{t("loading")}</div>;
  const sections = [];
  if (data.sales?.timeline) sections.push([t("salesEvolution"), data.sales.timeline, "value"]);
  if (data.sales?.products) sections.push([t("topProducts"), data.sales.products, "value"]);
  if (data.sales?.categories) sections.push([t("salesByCategory"), data.sales.categories, "value"]);
  if (data.sales?.customers) sections.push([t("salesByCustomer"), data.sales.customers, "value"]);
  if (data.sales?.warehouses) sections.push([t("salesByWarehouse"), data.sales.warehouses, "value"]);
  if (data.sales?.payment_methods) sections.push([t("paymentMethods"), data.sales.payment_methods, "value"]);
  if (data.purchases?.timeline) sections.push([t("purchasesEvolution"), data.purchases.timeline, "value"]);
  if (data.purchases?.suppliers) sections.push([t("purchasesBySupplier"), data.purchases.suppliers, "value"]);
  if (data.purchases?.products) sections.push([t("purchasesByProduct"), data.purchases.products, "value"]);
  if (data.purchases?.categories) sections.push([t("purchasesByCategory"), data.purchases.categories, "value"]);
  if (data.purchases?.orders) sections.push([t("purchaseOrders"), data.purchases.orders, "value"]);
  if (data.purchases?.receipts) sections.push([t("purchaseReceipts"), data.purchases.receipts, "value"]);
  if (data.purchases?.received_products) sections.push([t("receivedQuantities"), data.purchases.received_products, "quantity"]);
  if (data.customers) sections.push([t("customerBalances"), data.customers.balances, "balance_due"], [t("paymentsByCustomer"), data.customers.payments, "value"]);
  if (data.suppliers) sections.push([t("supplierBalances"), data.suppliers.balances, "balance_due"], [t("paymentsBySupplier"), data.suppliers.payments, "value"]);
  if (data.stock) sections.push([t("stockStatus"), data.stock.quantities, "quantity"], [t("mostMovedProducts"), data.stock.movements, "quantity"], [t("expirations"), data.stock.expirations, "quantity"]);
  if (data.finance) sections.push([t("cashEvolution"), data.finance.cash_timeline.map((row) => ({ ...row, value: Number(row.cash_in) - Number(row.cash_out) })), "value"], [t("paymentMethods"), data.finance.payment_methods, "value"], [t("cashRegisters"), data.finance.registers, "value"]);
  return <div className="mt-4 grid gap-4 xl:grid-cols-2">{sections.map(([title, rows, valueKey], index) => <ReportBlock key={`${category}:${index}`} title={title} rows={rows || []} valueKey={valueKey} emptyLabel={t("noDataForPeriod")}/>)}</div>;
}

function ReportBlock({ title, rows, valueKey, emptyLabel }) {
  const maximum = Math.max(1, ...rows.map((row) => Math.abs(Number(row[valueKey] || 0))));
  return <section className="border border-gray-300 bg-white"><h2 className="border-b px-4 py-3 text-[12px] font-black">{title}</h2>{rows.length ? <div className="max-h-[300px] overflow-auto p-4">{rows.slice(0, 20).map((row, index) => <div key={`${row.id || row.label}:${index}`} className="mb-3 last:mb-0"><div className="mb-1 flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-semibold">{row.label || row.designation || row.batch_number}</span><b className="shrink-0">{valueKey === "quantity" ? formatQuantity(row[valueKey]) : formatMoney(row[valueKey])}</b></div><div className="h-2 bg-gray-100"><div className={`h-full ${Number(row[valueKey]) < 0 ? "bg-red-500" : "bg-[#099323]"}`} style={{ width: `${Math.max(2, Math.abs(Number(row[valueKey] || 0)) / maximum * 100)}%` }}/></div></div>)}</div> : <div className="p-10 text-center text-[11px] text-black/40">{emptyLabel}</div>}</section>;
}
