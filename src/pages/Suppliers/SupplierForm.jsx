import { useEffect, useState } from "react";
import { Save, Truck, X } from "lucide-react";
import { createSupplier, updateSupplier } from "../../api/supplier.model";
import { useLanguage } from "../../i18n/LanguageContext";
import LegalBusinessFields from "../../components/forms/LegalBusinessFields";
import FormField, { inputClass } from "../../components/ui/FormField";
import ErrorMessage from "../../components/ui/ErrorMessage";
import { formatMoney } from "../../utils/formatters";

const empty = {
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
  opening_balance: "0",
  is_active: true,
};

export default function SupplierForm({ supplier, onSaved, onCancel }) {
  const { t } = useLanguage();
  const editing = Boolean(supplier);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(
      supplier
        ? {
            ...empty,
            ...supplier,
            opening_balance: String(supplier.opening_balance ?? 0),
            is_active: Boolean(supplier.is_active),
          }
        : empty,
    );
    setError("");
  }, [supplier]);

  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError(t("supplierNameRequired"));
      return;
    }
    try {
      setSaving(true);
      setError("");
      const payload = {
        ...form,
        name: form.name.trim(),
        opening_balance: Number(form.opening_balance),
      };
      onSaved(
        editing
          ? await updateSupplier(supplier.id, payload)
          : await createSupplier(payload),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-gray-300 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-[#fff4df] text-[#b86e00]">
            <Truck size={20} />
          </div>
          <div>
            <h2 className="text-[17px] font-bold">
              {t(editing ? "editSupplier" : "addSupplier")}
            </h2>
            <p className="mt-1 text-[12px] text-black/55">
              {t("supplierFormDescription")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          title={t("close")}
          className="flex h-[38px] w-[38px] items-center justify-center border border-gray-400"
        >
          <X size={18} />
        </button>
      </div>
      <ErrorMessage message={error} />
      <div className="space-y-6 p-5">
        <Section title={t("generalInformation")}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field
              label={t("supplierName")}
              name="name"
              value={form.name}
              onChange={change}
              required
            />
            <Field
              label={t("phoneNumber")}
              name="phone"
              value={form.phone || ""}
              onChange={change}
            />
            <Field
              label={t("emailAddress")}
              name="email"
              type="email"
              value={form.email || ""}
              onChange={change}
            />
            <Field
              label={t("businessActivity")}
              name="business_activity"
              value={form.business_activity || ""}
              onChange={change}
            />
          </div>
        </Section>
        <Section title={t("legalTaxInformation")}>
          <LegalBusinessFields values={form} onChange={change} t={t} />
        </Section>
        <Section title={t("address")}>
          <textarea
            name="address"
            value={form.address || ""}
            onChange={change}
            rows="3"
            className="w-full resize-none border border-gray-400 px-3 py-2 text-[13px] outline-none"
          />
        </Section>
        <Section title={t("financial")}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field
              label={t("openingBalance")}
              name="opening_balance"
              type="number"
              step="0.01"
              value={form.opening_balance}
              onChange={change}
            />
            <label className="flex items-center gap-3 border border-gray-300 bg-gray-50 p-4">
              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={change}
                className="h-4 w-4"
              />
              <span>
                <b className="block text-[13px]">{t("active")}</b>
                <span className="mt-1 block text-[11px] text-black/50">
                  {t("supplierActiveDescription")}
                </span>
              </span>
            </label>
          </div>
          <p className="mt-3 text-[11px] text-black/50">
            {t("supplierBalanceConvention")}
          </p>
        </Section>
        {editing && supplier?.account && (
          <Section title={t("supplierAccount")}>
            <div className="grid grid-cols-2 gap-3">
              <AccountValue
                label={t("supplierDebt")}
                value={supplier.account.payable}
                className="text-red-700"
              />
              <AccountValue
                label={t("availableCredit")}
                value={supplier.account.available_credit}
                className="text-green-700"
              />
            </div>
            <div className="mt-4 overflow-x-auto border border-gray-300">
              <table className="w-full text-left text-[12px] rtl:text-right">
                <thead>
                  <tr className="h-10 border-b bg-gray-50">
                    <th className="px-3">{t("date")}</th>
                    <th className="px-3">{t("type")}</th>
                    <th className="px-3">{t("reference")}</th>
                    <th className="px-3 text-right rtl:text-left">{t("amount")}</th>
                    <th className="px-3 text-right rtl:text-left">{t("balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!supplier.account_entries?.length ? (
                    <tr>
                      <td colSpan="5" className="h-20 text-center text-black/45">
                        {t("noAccountMovements")}
                      </td>
                    </tr>
                  ) : (
                    supplier.account_entries.map((entry) => (
                      <tr key={entry.id} className="h-10 border-b">
                        <td className="px-3">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td className="px-3">{entry.entry_type}</td>
                        <td className="px-3">{entry.document_reference || "—"}</td>
                        <td className={`px-3 text-right rtl:text-left ${Number(entry.amount) > 0 ? "text-red-700" : "text-green-700"}`}>
                          {Number(entry.amount) > 0 ? "+" : ""}
                          {formatMoney(entry.amount)}
                        </td>
                        <td className="px-3 text-right rtl:text-left">
                          {formatMoney(entry.balance_after)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-[42px] border border-gray-400 px-5 text-[13px] font-semibold"
        >
          {t("cancel")}
        </button>
        <button
          disabled={saving}
          className="flex h-[42px] items-center gap-2 border border-[#087c1e] bg-[#099323] px-5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          <Save size={17} />
          {saving ? t("saving") : t(editing ? "saveChanges" : "createSupplier")}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t border-gray-200 pt-5 first:border-0 first:pt-0">
      <h3 className="mb-4 text-[14px] font-bold">{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, required, ...props }) {
  return (
    <FormField label={label} required={required}>
      <input {...props} required={required} className={inputClass} />
    </FormField>
  );
}
function AccountValue({ label, value, className }) {
  return (
    <div className="border border-gray-300 bg-gray-50 p-3">
      <span className="text-[11px] text-black/50">{label}</span>
      <p className={`mt-1 text-[16px] font-bold ${className}`}>
        {formatMoney(value)}
      </p>
    </div>
  );
}
