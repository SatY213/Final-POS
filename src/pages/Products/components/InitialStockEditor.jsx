import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
export default function InitialStockEditor({
  rows,
  onChange,
  warehouses,
  activeWarehouseId,
  trackBatches,
  trackExpiration,
  trackSerials,
  productUnits,
  units,
}) {
  const { t } = useLanguage(),
    empty = () => ({
      warehouse_id: String(activeWarehouseId || warehouses[0]?.id || ""),
      product_unit_index: "0",
      quantity: "",
      batch_number: "",
      expiration_date: "",
      purchase_price: "",
      serial_numbers: [],
    }),
    total = rows.reduce(
      (sum, row) =>
        sum +
        (Number(row.quantity) || 0) *
          (Number(
            productUnits[Number(row.product_unit_index || 0)]
              ?.conversion_factor,
          ) || 1),
      0,
    );
  function update(index, patch) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  return (
    <section className="border border-gray-300 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <h3 className="text-[14px] font-bold">{t("INITIAL_STOCK")}</h3>
          <p className="mt-1 text-[11px] text-black/50">
            {t("Saisissez directement le stock disponible au démarrage.")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="border border-green-200 bg-green-50 px-3 py-2 text-right">
            <span className="block text-[10px] font-semibold uppercase text-black/45">
              {t("Total en unité de base")}
            </span>
            <b className="text-[17px] text-[#087c1e]">{total}</b>
          </div>
          <button
            type="button"
            onClick={() => onChange([...rows, empty()])}
            className="flex h-9 items-center gap-2 border border-gray-400 bg-white px-3 text-[12px] font-semibold"
          >
            <Plus size={15} />
            {t("addLine")}
          </button>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {rows.map((row, index) => {
          const factor =
              Number(
                productUnits[Number(row.product_unit_index || 0)]
                  ?.conversion_factor,
              ) || 1,
            base = (Number(row.quantity) || 0) * factor;
          return (
            <div
              key={index}
              className={`grid items-end gap-3 border border-gray-200 bg-gray-50 p-3 ${trackBatches ? "lg:grid-cols-4 xl:grid-cols-[1.1fr_1fr_1fr_120px_150px_130px_38px]" : "sm:grid-cols-[1fr_1fr_150px_120px_38px]"}`}
            >
              <SelectField
                label={t("warehouse")}
                value={row.warehouse_id}
                onChange={(value) => update(index, { warehouse_id: value })}
                options={warehouses}
                placeholder={t("selectWarehouse")}
              />
              <SelectField
                label={t("packaging")}
                value={row.product_unit_index}
                onChange={(value) =>
                  update(index, { product_unit_index: value })
                }
                options={productUnits.map((item, i) => ({
                  id: i,
                  name:
                    units.find(
                      (unit) => Number(unit.id) === Number(item.unit_id),
                    )?.name || t("genericUnit"),
                }))}
              />
              {trackBatches && (
                <TextField
                  label={t("batchLot")}
                  value={row.batch_number}
                  onChange={(value) => update(index, { batch_number: value })}
                />
              )}
              <TextField
                label={t("quantity")}
                type="number"
                min="0"
                step={trackSerials ? "1" : "0.01"}
                value={row.quantity}
                onChange={(value) => update(index, { quantity: value })}
              />
              <Info label={t("Stock réel")} value={`${base} unité(s)`} />
              {trackExpiration && (
                <TextField
                  label={t("expirationDate")}
                  type="date"
                  value={row.expiration_date}
                  onChange={(value) =>
                    update(index, { expiration_date: value })
                  }
                />
              )}{" "}
              {trackBatches && (
                <TextField
                  label={t("purchasePriceOptional")}
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.purchase_price}
                  onChange={(value) => update(index, { purchase_price: value })}
                />
              )}
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                disabled={rows.length === 1}
                title={t("remove")}
                className="flex h-[38px] w-[38px] items-center justify-center border border-red-300 text-red-700 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
              {trackSerials && (
                <SerialEditor
                  quantity={base}
                  values={row.serial_numbers || []}
                  onChange={(serial_numbers) =>
                    update(index, { serial_numbers })
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
function SerialEditor({ quantity, values = [], onChange }) {
  const { t } = useLanguage();
  const qty = Math.max(0, Number(quantity) || 0);

  const updateSerial = (index, value) => {
    const next = Array.from({ length: qty }, (_, i) => values[i] || "");
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="col-span-full">
      <div className="mb-2 flex justify-between text-[11px] font-semibold">
        <span>{t("Numéros de série")}</span>

        <span className="text-gray-500">
          {qty} {t("numéro")}{qty > 1 ? "s" : ""} {t("requis")}
        </span>
      </div>

      {qty > 0 ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: qty }).map((_, index) => (
            <div key={index} className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
                {index + 1}.
              </span>

              <input
                type="text"
                value={values[index] || ""}
                onChange={(e) => updateSerial(index, e.target.value)}
                placeholder={`SN-${String(index + 1).padStart(4, "0")}`}
                className="w-full border border-gray-400 bg-white py-2.5 pl-8 pr-3 font-mono text-[12px] outline-none focus:border-black"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-gray-300 p-4 text-center text-[12px] text-gray-500">
          {t("Saisissez une quantité pour ajouter les numéros de série.")}
        </div>
      )}
    </div>
  );
}
const TextField = ({ label, onChange, ...props }) => (
  <label>
    <span className="mb-2 block text-[11px] font-semibold">{label}</span>
    <input
      {...props}
      onChange={(e) => onChange(e.target.value)}
      className="h-[40px] w-full border border-gray-400 bg-white px-3 text-[12px] outline-none"
    />
  </label>
);
const SelectField = ({ label, value, onChange, options, placeholder }) => (
  <label>
    <span className="mb-2 block text-[11px] font-semibold">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[40px] w-full border border-gray-400 bg-white px-3 text-[12px] outline-none"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  </label>
);
const Info = ({ label, value }) => (
  <div>
    <span className="mb-2 block text-[11px] font-semibold">{label}</span>
    <div className="flex h-10 items-center border border-gray-300 bg-white px-3 text-[12px] font-bold text-[#087c1e]">
      {value}
    </div>
  </div>
);
