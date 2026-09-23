import { useEffect, useRef, useState } from "react";
import { getSettings, updateSettings } from "../../../../api/settings.model";
import { getWarehouses } from "../../../../api/warehouse.model";
import { getCashRegisters } from "../../../../api/cash-register.model";
import ErrorMessage from "../../../../components/ui/ErrorMessage";
import { inputClass } from "../../../../components/ui/FormField";
import { setRuntimeSettings } from "../../../../utils/runtimeSettings";
import { useLanguage } from "../../../../i18n/LanguageContext";

export default function GeneralTab() {
  const { t } = useLanguage();
  const [values, setValues] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saved = useRef("");
  useEffect(() => {
    Promise.all([getSettings("general"), getWarehouses(), getCashRegisters()])
      .then(([settings, warehouseRows, registerRows]) => {
        setValues(settings);
        setWarehouses(warehouseRows.filter((item) => item.is_active));
        setRegisters(registerRows.filter((item) => item.is_active));
        saved.current = JSON.stringify(settings);
        setRuntimeSettings(settings);
      }).catch((reason) => setError(reason.message));
  }, []);
  useEffect(() => {
    if (!values || JSON.stringify(values) === saved.current) return;
    const timer = window.setTimeout(async () => {
      try {
        setSaving(true); setError("");
        const updated = await updateSettings("general", values);
        saved.current = JSON.stringify(updated);
        setValues(updated);
        setRuntimeSettings(updated);
        document.title = updated.application_name;
      } catch (reason) { setError(reason.message); }
      finally { setSaving(false); }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [values]);
  if (!values) return <div className="border border-gray-300 bg-white p-10 text-center text-[12px] text-black/45">{t("loading")}</div>;
  const patch = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  function chooseLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1000000) {
      setError(t("logoFileError"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch("logo_data", String(reader.result));
    reader.onerror = () => setError(t("logoFileError"));
    reader.readAsDataURL(file);
  }
  const visibleRegisters = registers.filter((item) => !values.default_warehouse_id || Number(item.warehouse_id) === Number(values.default_warehouse_id));
  return <section className="border border-gray-300 bg-white">
    <ErrorMessage message={error} onClose={() => setError("")} />
    <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-[16px] font-bold">{t("generalPreferences")}</h2><p className="mt-1 text-[11px] text-black/50">{t("generalPreferencesDescription")}</p></div><span className="text-[10px] font-semibold text-black/45">{saving ? t("saving") : t("autoSave")}</span></div>
    <div className="grid gap-x-8 gap-y-5 p-5 lg:grid-cols-2">
      <Field label={t("applicationName")}><input className={inputClass} value={values.application_name} onChange={(e) => patch("application_name", e.target.value)}/></Field>
      <div>
        <span className="mb-1.5 block text-[11px] font-semibold">{t("companyLogo")}</span>
        <div className="flex min-h-20 items-center gap-4 border border-gray-300 p-3">
          {values.logo_data && <img src={values.logo_data} alt={t("companyLogo")} className="h-14 w-20 object-contain" />}
          <label className="cursor-pointer border border-gray-400 px-3 py-2 text-[11px] font-semibold hover:bg-gray-50">{t("chooseLogo")}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={chooseLogo} /></label>
          {values.logo_data && <button type="button" className="text-[11px] text-red-700" onClick={() => patch("logo_data", null)}>{t("removeLogo")}</button>}
        </div>
      </div>
      <Field label={t("defaultCurrency")}><select className={inputClass} value={values.default_currency} onChange={(e) => patch("default_currency", e.target.value)}><option value="DZD">{t("DZD · Dinar algérien")}</option><option value="EUR">{t("EUR · Euro")}</option><option value="USD">{t("USD · Dollar")}</option></select></Field>
      <Field label={t("currencyDisplay")}><select className={inputClass} value={values.currency_display} onChange={(e) => patch("currency_display", e.target.value)}><option value="SYMBOL_AFTER">1 000.00 DA</option><option value="CODE_AFTER">1 000.00 DZD</option><option value="CODE_BEFORE">DZD 1 000.00</option></select></Field>
      <Field label={t("monetaryDecimals")}><select className={inputClass} value={values.monetary_decimals} onChange={(e) => patch("monetary_decimals", Number(e.target.value))}>{[0,1,2,3,4].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
      <Field label={t("dateFormat")}><select className={inputClass} value={values.date_format} onChange={(e) => patch("date_format", e.target.value)}>{["DD/MM/YYYY","YYYY-MM-DD","MM/DD/YYYY"].map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label={t("timeFormat")}><select className={inputClass} value={values.time_format} onChange={(e) => patch("time_format", e.target.value)}><option value="24H">24 h</option><option value="12H">12 h</option></select></Field>
      <Field label={t("defaultWarehouse")}><select className={inputClass} value={values.default_warehouse_id || ""} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : null; setValues((current) => ({ ...current, default_warehouse_id: id, default_cash_register_id: null })); }}><option value="">{t("noDefaultValue")}</option>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field label={t("defaultCashRegister")}><select className={inputClass} value={values.default_cash_register_id || ""} onChange={(e) => patch("default_cash_register_id", e.target.value ? Number(e.target.value) : null)}><option value="">{t("noDefaultValue")}</option>{visibleRegisters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field label={t("defaultPageSize")}><select className={inputClass} value={values.default_page_size} onChange={(e) => patch("default_page_size", Number(e.target.value))}>{[25,50,100].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
      <Toggle label={t("productImagesEnabled")} checked={values.product_images_enabled} onChange={(value) => patch("product_images_enabled", value)}/>
      <Toggle label={t("confirmDestructiveActions")} checked={values.confirm_destructive_actions} onChange={(value) => patch("confirm_destructive_actions", value)}/>
    </div>
  </section>;
}
function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold">{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange }) { return <label className="flex min-h-11 items-center justify-between border border-gray-300 px-4"><span className="text-[11px] font-semibold">{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#099323]"/></label>; }
