import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import BarcodeEditor from "./BarcodeEditor";

export default function ProductUnitsEditor({ value, onChange, units }) {
  const { t } = useLanguage();
  const update = (index, patch) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  function add() {
    onChange([
      ...value,
      {
        unit_id: "",
        conversion_factor: "",
        purchase_price: "0",
        selling_price: "0",
        is_base: false,
        is_active: true,
        barcodes: [],
      },
    ]);
  }
  function remove(index) {
    if (value[index].is_base) return;
    onChange(value.filter((_, i) => i !== index));
  }
  return (
    <section className="border-t border-gray-200 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold">{t("unitsPackaging")}</h3>
          <p className="mt-1 text-[11px] text-black/50">
            {t("unitsPackagingDescription")}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="flex h-9 items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"
        >
          <Plus size={15} />
          {t("addPackaging")}
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {value.map((row, index) => (
          <div
            key={row.id || index}
            className="border border-gray-300 bg-gray-50 p-4"
          >
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_150px_160px_160px_100px_38px]">
              <Field label={t(row.is_base ? "baseUnitOptional" : "unit")}>
                <select
                  value={row.unit_id}
                  onChange={(e) => update(index, { unit_id: e.target.value })}
                  required={!row.is_base}
                  className="h-[40px] w-full border border-gray-400 bg-white px-3 text-[12px]"
                >
                  <option value="">
                    {t(row.is_base ? "noSpecifiedUnit" : "selectOption")}
                  </option>
                  {units
                    .filter(
                      (unit) =>
                        !unit.is_builtin &&
                        (unit.is_active ||
                          Number(unit.id) === Number(row.unit_id)),
                    )
                    .map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                        {unit.symbol ? ` (${unit.symbol})` : ""}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={t(row.is_base ? "baseQuantity" : "contains")}>
                <div className="flex h-[40px] items-center border border-gray-300 bg-white px-3 text-[12px] font-semibold">
                  {row.is_base ? (
                    "1"
                  ) : (
                    <input
                      type="number"
                      min="0.000001"
                      step="any"
                      value={row.conversion_factor}
                      onChange={(e) =>
                        update(index, { conversion_factor: e.target.value })
                      }
                      className="h-full w-full bg-transparent outline-none"
                    />
                  )}
                </div>
              </Field>
              <Field label={t("purchasePrice")}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.purchase_price}
                  onChange={(e) =>
                    update(index, { purchase_price: e.target.value })
                  }
                  className="h-[40px] w-full border border-gray-400 bg-white px-3 text-[12px]"
                />
              </Field>
              <Field label={t("sellingPrice")}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.selling_price}
                  onChange={(e) =>
                    update(index, { selling_price: e.target.value })
                  }
                  className="h-[40px] w-full border border-gray-400 bg-white px-3 text-[12px]"
                />
              </Field>
              <span className="flex h-[40px] items-center text-[11px] font-semibold text-black/55">
                {row.is_base ? t("baseUnit") : t("packaging")}
              </span>
              <button
                type="button"
                disabled={row.is_base}
                onClick={() => remove(index)}
                title={t("remove")}
                className="flex h-[38px] w-[38px] items-center justify-center border border-red-300 text-red-700 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <BarcodeEditor
              compact
              value={row.barcodes}
              radioName={`primary_barcode_${index}`}
              onChange={(barcodes) => update(index, { barcodes })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
function Field({ label, children }) {
  return (
    <label>
      <span className="mb-2 block text-[11px] font-semibold">{label}</span>
      {children}
    </label>
  );
}
