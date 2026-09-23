import { useEffect, useState } from "react";
import { Save, X, Monitor } from "lucide-react";
import {
  createCashRegister,
  updateCashRegister,
} from "../../../../api/cash-register.model";
import { useLanguage } from "../../../../i18n/LanguageContext";

const emptyForm = {
  warehouse_id: "",
  name: "",
  code: "",
  is_active: true,
};

export default function CashRegisterForm({
  cashRegister,
  warehouses,
  onSaved,
  onCancel,
}) {
  const { t } = useLanguage();
  const isEditing = Boolean(cashRegister);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFormData(
      cashRegister
        ? {
            warehouse_id: String(cashRegister.warehouse_id),
            name: cashRegister.name || "",
            code: cashRegister.code || "",
            is_active: Boolean(cashRegister.is_active),
          }
        : {
            ...emptyForm,
            warehouse_id: warehouses[0] ? String(warehouses[0].id) : "",
          },
    );
    setError("");
  }, [cashRegister, warehouses]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (
      !formData.warehouse_id ||
      !formData.name.trim() ||
      !formData.code.trim()
    ) {
      setError(t("registerRequiredError"));
      return;
    }
    try {
      setSaving(true);
      setError("");
      const payload = {
        ...formData,
        warehouse_id: Number(formData.warehouse_id),
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
      };
      const saved = isEditing
        ? await updateCashRegister(cashRegister.id, payload)
        : await createCashRegister(payload);
      await onSaved(saved);
    } catch (err) {
      setError(err.message || t("saveRegisterFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-300 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]">
            <Monitor size={20} strokeWidth={1.9} />
          </div>
          <div>
            <h2 className="text-[17px] font-bold">
              {t(isEditing ? "editCashRegister" : "addCashRegister")}
            </h2>
            <p className="mt-1 text-[12px] text-black/55">
              {t("cashRegisterFormDescription")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          title={t("close")}
          className="flex h-[38px] w-[38px] items-center justify-center border border-gray-400 bg-white"
        >
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-[13px] font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
        <Field
          label={t("name")}
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <Field
          label={t("code")}
          name="code"
          value={formData.code}
          onChange={handleChange}
          required
        />
        <div className="lg:col-span-2">
          <label
            htmlFor="warehouse_id"
            className="mb-2 block text-[12px] font-semibold"
          >
            {t("warehouse")} <span className="text-red-600">*</span>
          </label>
          <select
            id="warehouse_id"
            name="warehouse_id"
            value={formData.warehouse_id}
            onChange={handleChange}
            required
            className="h-[42px] w-full border border-gray-400 bg-white px-3 text-[13px] outline-none"
          >
            <option value="">{t("selectWarehouse")}</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-3 border border-gray-300 bg-gray-50 p-4 lg:col-span-2">
          <input
            type="checkbox"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            className="h-4 w-4"
          />
          <span>
            <span className="block text-[13px] font-semibold">
              {t("active")}
            </span>
            <span className="mt-1 block text-[11px] text-black/50">
              {t("registerActiveDescription")}
            </span>
          </span>
        </label>
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-[42px] border border-gray-400 bg-white px-5 text-[13px] font-semibold disabled:opacity-50"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex h-[42px] items-center gap-2 border border-[#087c1e] bg-[#099323] px-5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          <Save size={17} />
          {saving
            ? t("saving")
            : t(isEditing ? "saveChanges" : "createCashRegister")}
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, value, onChange, required }) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[12px] font-semibold">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      <input
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="h-[42px] w-full border border-gray-400 bg-white px-3 text-[13px] outline-none"
      />
    </div>
  );
}
