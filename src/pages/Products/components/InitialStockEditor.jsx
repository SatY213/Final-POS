import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";

export default function InitialStockEditor({ rows, onChange, warehouses, activeWarehouseId, trackBatches, trackExpiration, productUnits, units }) {
  const { t } = useLanguage();
  const empty = () => ({ warehouse_id: activeWarehouseId ? String(activeWarehouseId) : "", product_unit_index: "0", quantity: "", batch_number: "", expiration_date: "", purchase_price: "" });
  function update(index, patch) { onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)); }
  return <section className="border-t border-gray-200 pt-5">
    <div className="flex items-center justify-between"><div><h3 className="text-[14px] font-bold">{t("initialStockOptional")}</h3><p className="mt-1 text-[11px] text-black/50">{t(trackBatches ? "initialBatchDescription" : "initialStockDescription")}</p></div><button type="button" onClick={() => onChange([...rows, empty()])} className="flex h-9 items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"><Plus size={15} />{t(trackBatches ? "addBatch" : "addWarehouseStock")}</button></div>
    <div className="mt-4 space-y-3">{rows.map((row, index) => <div key={index} className={`grid items-end gap-3 border border-gray-200 bg-gray-50 p-3 ${trackBatches ? "lg:grid-cols-4 xl:grid-cols-[1.1fr_1fr_1fr_120px_150px_130px_38px]" : "sm:grid-cols-[1fr_1fr_180px_38px]"}`}>
      <SelectField label={t("warehouse")} value={row.warehouse_id} onChange={(value) => update(index, { warehouse_id: value })} options={warehouses} placeholder={t("selectWarehouse")} />
      <SelectField label={t("packaging")} value={row.product_unit_index} onChange={(value)=>update(index,{product_unit_index:value})} options={productUnits.map((item,i)=>({id:i,name:units.find(unit=>Number(unit.id)===Number(item.unit_id))?.name||t("genericUnit")}))}/>
      {trackBatches && <TextField label={t("batchLot")} value={row.batch_number} onChange={(value) => update(index, { batch_number: value })} />}
      <TextField label={t("quantity")} type="number" min="0" step="0.01" value={row.quantity} onChange={(value) => update(index, { quantity: value })} />
      {trackExpiration && <TextField label={t("expirationDate")} type="date" value={row.expiration_date} onChange={(value) => update(index, { expiration_date: value })} />}
      {trackBatches && <TextField label={t("purchasePriceOptional")} type="number" min="0" step="0.01" value={row.purchase_price} onChange={(value) => update(index, { purchase_price: value })} />}
      <button type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} title={t("remove")} className="flex h-[38px] w-[38px] items-center justify-center border border-red-300 text-red-700"><Trash2 size={16} /></button>
    </div>)}</div>
  </section>;
}

function TextField({ label, onChange, ...props }) { return <label><span className="mb-2 block text-[11px] font-semibold">{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="h-[40px] w-full border border-gray-400 bg-white px-3 text-[12px] outline-none" /></label>; }
function SelectField({ label, value, onChange, options, placeholder }) { return <label><span className="mb-2 block text-[11px] font-semibold">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-[40px] w-full border border-gray-400 bg-white px-3 text-[12px] outline-none"><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>; }
