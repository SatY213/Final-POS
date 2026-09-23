import { useEffect, useState } from "react";
import { Save, UserRound, X } from "lucide-react";
import { createCustomer, updateCustomer } from "../../api/customer.model";
import { useLanguage } from "../../i18n/LanguageContext";
import LegalBusinessFields from "../../components/forms/LegalBusinessFields";
import FormField, { inputClass } from "../../components/ui/FormField";
import ErrorMessage from "../../components/ui/ErrorMessage";
const empty = {
  name: "",
  phone: "",
  email: "",
  nif: "",
  nis: "",
  tax_article: "",
  commercial_register: "",
  address: "",
  business_activity: "",
  opening_balance: "0",
  is_active: true,
};
export default function CustomerForm({ customer, onSaved, onCancel }) {
  const { t } = useLanguage(),
    editing = Boolean(customer),
    [form, setForm] = useState(empty),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setForm(
      customer
        ? {
            ...empty,
            ...customer,
            opening_balance: String(customer.opening_balance ?? 0),
            is_active: Boolean(customer.is_active),
          }
        : empty,
    );
    setError("");
  }, [customer]);
  function change(e) {
    const { name, value, type, checked } = e.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }
  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(t("customerNameRequired"));
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
          ? await updateCustomer(customer.id, payload)
          : await createCustomer(payload),
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
          <div className="flex h-10 w-10 items-center justify-center bg-[#eef0ff] text-[#4f46e5]">
            <UserRound size={20} />
          </div>
          <div>
            <h2 className="text-[17px] font-bold">
              {t(editing ? "editCustomer" : "addCustomer")}
            </h2>
            <p className="mt-1 text-[12px] text-black/55">
              {t("customerFormDescription")}
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
              label={t("customerName")}
              name="name"
              value={form.name}
              onChange={change}
              required
            />
            <Field
              label={t("phoneNumber")}
              name="phone"
              value={form.phone}
              onChange={change}
            />
            <Field
              label={t("emailAddress")}
              name="email"
              type="email"
              value={form.email}
              onChange={change}
            />
            <Field
              label={t("businessActivity")}
              name="business_activity"
              value={form.business_activity}
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
            value={form.address}
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
                  {t("customerActiveDescription")}
                </span>
              </span>
            </label>
          </div>
          <p className="mt-3 text-[11px] text-black/50">
            {t("customerBalanceConvention")}
          </p>
        </Section>
        {editing && customer?.account && (
          <Section title={t("Compte client")}>
            <div className="grid grid-cols-2 gap-3">
              <AccountValue
                label={t("Dette actuelle")}
                value={customer.account.receivable}
                className="text-red-700"
              />
              <AccountValue
                label={t("Solde disponible")}
                value={customer.account.available_credit}
                className="text-green-700"
              />
            </div>
            <div className="mt-4 overflow-x-auto border border-gray-300">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="h-10 border-b bg-gray-50">
                    <th className="px-3">{t("date")}</th>
                    <th className="px-3">{t("type")}</th>
                    <th className="px-3">{t("reference")}</th>
                    <th className="px-3 text-right">{t("Mouvement")}</th>
                    <th className="px-3 text-right">{t("balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!customer.account_entries?.length ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="h-20 text-center text-black/45"
                      >
                        {t("noAccountMovements")}
                      </td>
                    </tr>
                  ) : (
                    customer.account_entries.map((entry) => (
                      <tr key={entry.id} className="h-10 border-b">
                        <td className="px-3">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td className="px-3">
                          {t(accountEntryLabel(entry.entry_type))}
                        </td>
                        <td className="px-3">
                          {entry.sale_number || entry.reference || "—"}
                        </td>
                        <td
                          className={`px-3 text-right ${Number(entry.amount) > 0 ? "text-red-700" : "text-green-700"}`}
                        >
                          {Number(entry.amount) > 0 ? "+" : ""}
                          {Number(entry.amount).toFixed(2)} DA
                        </td>
                        <td className="px-3 text-right">
                          {Number(entry.balance_after).toFixed(2)} DA
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
          {saving ? t("saving") : t(editing ? "saveChanges" : "createCustomer")}
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
        {Number(value || 0).toFixed(2)} DA
      </p>
    </div>
  );
}
function accountEntryLabel(type) {
  return (
    {
      SALE_CREDIT: "Vente à crédit",
      CUSTOMER_PAYMENT: "Règlement client",
      CREDIT_USAGE: "Utilisation avance",
      ADJUSTMENT: "Ajustement",
    }[type] || type
  );
}
