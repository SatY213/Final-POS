import { useEffect, useState } from "react";
import { Save, X, Warehouse } from "lucide-react";

import {
  createWarehouse,
  updateWarehouse,
} from "../../../../api/warehouse.model";
import { useLanguage } from "../../../../i18n/LanguageContext";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  nif: "",
  nis: "",
  rib: "",
  tax_article: "",
  commercial_register: "",
  address: "",
  business_activity: "",
  can_sell: true,
  is_active: true,
};

export function WarehouseForm({ warehouse = null, onSaved, onCancel }) {
  const { t } = useLanguage();
  const isEditing = Boolean(warehouse);

  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (warehouse) {
      setFormData({
        name: warehouse.name || "",
        phone: warehouse.phone || "",
        email: warehouse.email || "",
        nif: warehouse.nif || "",
        nis: warehouse.nis || "",
        rib: warehouse.rib || "",
        tax_article: warehouse.tax_article || "",
        commercial_register: warehouse.commercial_register || "",
        address: warehouse.address || "",
        business_activity: warehouse.business_activity || "",
        can_sell: Boolean(warehouse.can_sell),
        is_active: Boolean(warehouse.is_active),
      });
    } else {
      setFormData(emptyForm);
    }

    setError("");
  }, [warehouse]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError(t("warehouseNameRequired"));
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...formData,
        name: formData.name.trim(),
      };

      let savedWarehouse;

      if (isEditing) {
        savedWarehouse = await updateWarehouse(warehouse.id, payload);
      } else {
        savedWarehouse = await createWarehouse(payload);
      }

      if (onSaved) {
        onSaved(savedWarehouse);
      }
    } catch (err) {
      setError(
        err.message || t("saveWarehouseFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-300 bg-white">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]">
            <Warehouse size={20} strokeWidth={1.9} />
          </div>

          <div>
            <h2 className="text-[17px] font-bold">
              {t(isEditing ? "editWarehouse" : "addWarehouse")}
            </h2>

            <p className="mt-1 text-[12px] text-black/55">
              {isEditing
                ? t("warehouseEditDescription")
                : t("warehouseAddDescription")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="
            flex h-[38px] w-[38px]
            items-center justify-center
            border border-gray-400
            bg-white
            text-black
          "
          title={t("close")}
        >
          <X size={18} strokeWidth={1.9} />
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-[13px] font-medium text-red-700">
          {error}
        </div>
      )}

      {/* FIELDS */}
      <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
        <Field
          label={t("name")}
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />

        <Field
          label={t("phoneNumber")}
          name="phone"
          value={formData.phone}
          onChange={handleChange}
        />

        <Field
          label={t("emailAddress")}
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />

        <Field
          label={t("taxId")}
          name="nif"
          value={formData.nif}
          onChange={handleChange}
        />

        <Field
          label={t("statisticalId")}
          name="nis"
          value={formData.nis}
          onChange={handleChange}
        />

        <Field
          label={t("rib")}
          name="rib"
          value={formData.rib}
          onChange={handleChange}
        />

        <Field
          label={t("taxArticle")}
          name="tax_article"
          value={formData.tax_article}
          onChange={handleChange}
        />

        <Field
          label={t("commercialRegister")}
          name="commercial_register"
          value={formData.commercial_register}
          onChange={handleChange}
        />

        <Field
          label={t("businessActivity")}
          name="business_activity"
          value={formData.business_activity}
          onChange={handleChange}
        />

        <div className="lg:col-span-2">
          <label className="mb-2 block text-[12px] font-semibold text-black">
            {t("address")}
          </label>

          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows="3"
            className="
              w-full
              resize-none
              border border-gray-400
              bg-white
              px-3 py-2
              text-[13px]
              text-black
              outline-none
            "
          />
        </div>

        {/* OPTIONS */}
        <div className="lg:col-span-2">
          <div className="border border-gray-300 bg-gray-50 p-4">
            <p className="mb-4 text-[12px] font-semibold">{t("warehouseOptions")}</p>

            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="can_sell"
                  checked={formData.can_sell}
                  onChange={handleChange}
                  className="h-4 w-4"
                />

                <div>
                  <p className="text-[13px] font-semibold">{t("canSell")}</p>

                  <p className="mt-[2px] text-[11px] text-black/50">
                    {t("canSellDescription")}
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="h-4 w-4"
                />

                <div>
                  <p className="text-[13px] font-semibold">{t("active")}</p>

                  <p className="mt-[2px] text-[11px] text-black/50">
                    {t("warehouseActiveDescription")}
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="
            h-[42px]
            border border-gray-400
            bg-white
            px-5
            text-[13px]
            font-semibold
            text-black
            disabled:opacity-50
          "
        >
          {t("cancel")}
        </button>

        <button
          type="submit"
          disabled={saving}
          className="
            flex h-[42px]
            items-center gap-2
            border border-[#087c1e]
            bg-[#099323]
            px-5
            text-[13px]
            font-semibold
            text-white
            disabled:opacity-50
          "
        >
          <Save size={17} strokeWidth={1.9} />

          {saving
            ? t("saving")
            : isEditing
              ? t("saveChanges")
              : t("createWarehouse")}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-[12px] font-semibold text-black"
      >
        {label}

        {required && <span className="ml-1 text-red-600">*</span>}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className="
          h-[42px]
          w-full
          border border-gray-400
          bg-white
          px-3
          text-[13px]
          text-black
          outline-none
        "
      />
    </div>
  );
}
