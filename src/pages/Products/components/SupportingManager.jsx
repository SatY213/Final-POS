import { useEffect, useState } from "react";
import { Plus, Save, X } from "lucide-react";
import {
  createCategory,
  createUnit,
  getCategories,
  getUnits,
  setCategoryActive,
  setUnitActive,
  updateCategory,
  updateUnit,
} from "../../../api/product.model";
import { useLanguage } from "../../../i18n/LanguageContext";

export default function SupportingManager({ type, onDone, onChanged }) {
  const { t } = useLanguage();
  const isCategory = type === "category";
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    try {
      setLoading(true);
      setError("");
      setItems(isCategory ? await getCategories() : await getUnits());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [type]);
  function startEdit(item) {
    setEditing(item);
    setName(item.name);
    setSymbol(item.symbol || "");
    setError("");
  }
  function reset() {
    setEditing(null);
    setName("");
    setSymbol("");
    setError("");
  }
  async function save(event) {
    event.preventDefault();
    if (!name.trim() || (!isCategory && !symbol.trim())) return;
    try {
      setSaving(true);
      setError("");
      if (isCategory) {
        editing
          ? await updateCategory(editing.id, { name: name.trim() })
          : await createCategory({ name: name.trim() });
      } else {
        editing
          ? await updateUnit(editing.id, {
              name: name.trim(),
              symbol: symbol.trim(),
            })
          : await createUnit({ name: name.trim(), symbol: symbol.trim() });
      }
      reset();
      await load();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  async function toggle(item) {
    try {
      setError("");
      isCategory
        ? await setCategoryActive(item.id, !item.is_active)
        : await setUnitActive(item.id, !item.is_active);
      await load();
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section className="border border-gray-300 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h1 className="text-[17px] font-bold">
            {t(isCategory ? "manageCategories" : "manageUnits")}
          </h1>
          <p className="mt-1 text-[12px] text-black/55">
            {t(isCategory ? "categoriesDescription" : "unitsDescription")}
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="flex h-[38px] items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"
        >
          <X size={16} />
          {t("close")}
        </button>
      </div>
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-[12px] text-red-700">
          {error}
        </div>
      )}
      <form
        onSubmit={save}
        className="grid grid-cols-1 items-end gap-3 border-b border-gray-200 bg-gray-50 p-4 sm:grid-cols-[1fr_160px_auto]"
      >
        <label>
          <span className="mb-2 block text-[11px] font-semibold">
            {t(isCategory ? "categoryName" : "unitName")}
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-[40px] w-full border border-gray-400 bg-white px-3 text-[12px] outline-none"
          />
        </label>
        {!isCategory && (
          <label>
            <span className="mb-2 block text-[11px] font-semibold">
              {t("symbol")}
            </span>
            <input
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              className="h-[40px] w-full border border-gray-400 bg-white px-3 text-[12px] outline-none"
            />
          </label>
        )}
        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={reset}
              className="h-[40px] border border-gray-400 px-3 text-[12px] font-semibold"
            >
              {t("cancel")}
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex h-[40px] items-center gap-2 border border-[#087c1e] bg-[#099323] px-4 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {editing ? <Save size={15} /> : <Plus size={15} />}
            {saving
              ? t("saving")
              : t(
                  editing
                    ? "saveChanges"
                    : isCategory
                      ? "addCategory"
                      : "addUnit",
                )}
          </button>
        </div>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left rtl:text-right">
          <thead>
            <tr className="h-[44px] border-b border-gray-300 bg-gray-50">
              <th className="px-5 text-[12px] font-semibold">
                {t(isCategory ? "category" : "unit")}
              </th>
              {!isCategory && (
                <th className="px-4 text-[12px] font-semibold">
                  {t("symbol")}
                </th>
              )}
              <th className="px-4 text-[12px] font-semibold">{t("status")}</th>
              <th className="px-4 text-right text-[12px] font-semibold rtl:text-left">
                {t("action")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="4"
                  className="h-[100px] text-center text-[12px] text-black/50"
                >
                  {t("loading")}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="h-[48px] border-b border-gray-200">
                  <td className="px-5 text-[13px] font-semibold">
                    {item.name}
                  </td>
                  {!isCategory && (
                    <td className="px-4 text-[13px]">{item.symbol}</td>
                  )}
                  <td className="px-4">
                    <Status active={item.is_active} t={t} />
                  </td>
                  <td className="px-4 text-right rtl:text-left">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="me-2 h-[30px] border border-gray-400 px-3 text-[11px] font-semibold"
                    >
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      className={`h-[30px] border px-3 text-[11px] font-semibold ${item.is_active ? "border-red-300 text-red-700" : "border-green-300 text-green-700"}`}
                    >
                      {t(item.is_active ? "deactivate" : "activate")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Status({ active, t }) {
  return (
    <span
      className={`inline-flex h-[26px] items-center border px-2 text-[11px] font-semibold ${active ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 bg-gray-100 text-black/55"}`}
    >
      {t(active ? "active" : "inactive")}
    </span>
  );
}
