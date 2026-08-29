import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";

export default function BarcodeEditor({ value, onChange, compact = false, radioName = "primary_barcode" }) {
  const { t } = useLanguage();
  function update(index, patch) {
    onChange(value.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : patch.is_primary ? { ...row, is_primary: false } : row));
  }
  function add() { onChange([...value, { barcode: "", is_primary: value.length === 0 }]); }
  function remove(index) {
    const next = value.filter((_, rowIndex) => rowIndex !== index);
    if (next.length && !next.some((row) => row.is_primary)) next[0] = { ...next[0], is_primary: true };
    onChange(next);
  }
  return <section className={`${compact ? "mt-4 border-t border-gray-200 pt-3" : "border-t border-gray-200 pt-5"}`}>
    <div className="flex items-center justify-between"><div><h3 className="text-[14px] font-bold">{t("barcodes")}</h3><p className="mt-1 text-[11px] text-black/50">{t("barcodesDescription")}</p></div><button type="button" onClick={add} className="flex h-9 items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"><Plus size={15} />{t("addBarcode")}</button></div>
    <div className="mt-3 space-y-3">{value.length === 0 ? <p className="text-[12px] text-black/50">{t("noBarcodes")}</p> : value.map((row, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_110px_38px] items-center gap-3"><input value={row.barcode} onChange={(event) => update(index, { barcode: event.target.value })} placeholder={t("barcode")} className="h-[40px] border border-gray-400 bg-white px-3 text-[13px] outline-none" /><label className="flex h-[40px] items-center gap-2 border border-gray-300 bg-white px-3 text-[12px] font-semibold"><input type="radio" name={radioName} checked={row.is_primary} onChange={() => update(index, { is_primary: true })} />{t("primary")}</label><button type="button" onClick={() => remove(index)} title={t("remove")} className="flex h-[38px] w-[38px] items-center justify-center border border-red-300 text-red-700"><Trash2 size={16} /></button></div>)}</div>
  </section>;
}
