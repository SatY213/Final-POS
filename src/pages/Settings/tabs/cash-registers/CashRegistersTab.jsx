import { useEffect, useState } from "react";
import { Monitor, Plus, RefreshCw } from "lucide-react";
import { getCashRegisters } from "../../../../api/cash-register.model";
import { getWarehouses } from "../../../../api/warehouse.model";
import CashRegisterForm from "./CashRegisterForm";
import { useLanguage } from "../../../../i18n/LanguageContext";

export default function CashRegistersTab() {
  const { t } = useLanguage();
  const [cashRegisters, setCashRegisters] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [registerData, warehouseData] = await Promise.all([getCashRegisters(), getWarehouses()]);
      setCashRegisters(registerData);
      setWarehouses(warehouseData);
    } catch (err) {
      setError(err.message || t("loadRegistersFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  if (showForm) return <CashRegisterForm cashRegister={selected} warehouses={warehouses} onCancel={() => { setShowForm(false); setSelected(null); }} onSaved={async () => { setShowForm(false); setSelected(null); await loadData(); }} />;

  return <section className="border border-gray-300 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]"><Monitor size={20} /></div>
        <div><h2 className="text-[17px] font-bold">{t("cashRegisters")}</h2><p className="mt-1 text-[12px] text-black/55">{t("cashRegistersDescription")}</p></div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={loadData} disabled={loading} title={t("refresh")} className="flex h-[42px] items-center gap-2 border border-gray-400 bg-white px-4 text-[13px] font-semibold disabled:opacity-50"><RefreshCw size={17} />{t("refresh")}</button>
        <button type="button" onClick={() => { setSelected(null); setShowForm(true); }} disabled={!warehouses.length} className="flex h-[42px] items-center gap-2 border border-[#087c1e] bg-[#099323] px-4 text-[13px] font-semibold text-white disabled:opacity-50"><Plus size={18} />{t("addCashRegister")}</button>
      </div>
    </div>
    {error && <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-[13px] font-medium text-red-700">{error}</div>}
    {!loading && !warehouses.length && <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-[13px] text-amber-800">{t("createWarehouseFirst")}</div>}
    <div className="overflow-x-auto"><table className="w-full border-collapse text-left rtl:text-right">
      <thead><tr className="h-[44px] border-b border-gray-300 bg-gray-50"><th className="px-5 text-[12px] font-semibold">{t("name")}</th><th className="px-4 text-[12px] font-semibold">{t("code")}</th><th className="px-4 text-[12px] font-semibold">{t("warehouse")}</th><th className="px-4 text-[12px] font-semibold">{t("status")}</th><th className="w-[90px] px-4 text-right text-[12px] font-semibold rtl:text-left">{t("action")}</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan="5" className="h-[120px] text-center text-[13px] text-black/50">{t("loadingCashRegisters")}</td></tr> : !cashRegisters.length ? <tr><td colSpan="5" className="h-[150px] text-center text-[13px] font-semibold">{t("noCashRegisters")}</td></tr> : cashRegisters.map((item) => <tr key={item.id} className="h-[48px] border-b border-gray-200">
        <td className="px-5 text-[13px] font-semibold">{item.name}</td><td className="px-4 text-[13px]">{item.code}</td><td className="px-4 text-[13px]">{item.warehouse_name}</td>
        <td className="px-4"><span className={`inline-flex h-[26px] items-center border px-2 text-[11px] font-semibold ${item.is_active ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 bg-gray-100 text-black/55"}`}>{t(item.is_active ? "active" : "inactive")}</span></td>
        <td className="px-4 text-right rtl:text-left"><button type="button" onClick={() => { setSelected(item); setShowForm(true); }} className="h-[30px] border border-gray-400 bg-white px-3 text-[12px] font-semibold">{t("edit")}</button></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
