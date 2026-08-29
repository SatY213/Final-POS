import { useEffect, useState } from "react";
import { Save, UserRound, X } from "lucide-react";
import { createUser, updateUser } from "../../../../api/user.model";
import { useLanguage } from "../../../../i18n/LanguageContext";

const roles = ["admin", "manager", "cashier", "stock"];
const emptyForm = {
  name: "",
  username: "",
  password: "",
  role: "cashier",
  warehouse_id: "",
  is_active: true,
};

export default function UserForm({ user, warehouses, onSaved, onCancel }) {
  const { t } = useLanguage();
  const editing = Boolean(user);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(
      user
        ? {
            name: user.name || "",
            username: user.username || "",
            password: "",
            role: user.role || "cashier",
            warehouse_id: user.warehouse_id ? String(user.warehouse_id) : "",
            is_active: Boolean(user.is_active),
          }
        : emptyForm,
    );
    setError("");
  }, [user]);

  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }
  async function submit(event) {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !form.username.trim() ||
      (!editing && form.password.length < 6)
    ) {
      setError(t("userRequiredError"));
      return;
    }
    try {
      setSaving(true);
      setError("");
      const payload = {
        ...form,
        name: form.name.trim(),
        username: form.username.trim(),
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
      };
      const saved = editing
        ? await updateUser(user.id, payload)
        : await createUser(payload);
      await onSaved(saved);
    } catch (err) {
      setError(err.message || t("saveUserFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-gray-300 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]">
            <UserRound size={20} />
          </div>
          <div>
            <h2 className="text-[17px] font-bold">
              {t(editing ? "editUser" : "addUser")}
            </h2>
            <p className="mt-1 text-[12px] text-black/55">
              {t("userFormDescription")}
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
          value={form.name}
          onChange={change}
          required
        />
        <Field
          label={t("username")}
          name="username"
          value={form.username}
          onChange={change}
          required
        />
        <Field
          label={t("password")}
          name="password"
          type="password"
          value={form.password}
          onChange={change}
          required={!editing}
          hint={editing ? t("passwordEditHint") : t("passwordHint")}
        />
        <div>
          <label
            htmlFor="role"
            className="mb-2 block text-[12px] font-semibold"
          >
            {t("role")}
          </label>
          <select
            id="role"
            name="role"
            value={form.role}
            onChange={change}
            className="h-[42px] w-full border border-gray-400 bg-white px-3 text-[13px] outline-none"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {t(`role_${role}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label
            htmlFor="warehouse_id"
            className="mb-2 block text-[12px] font-semibold"
          >
            {t("warehouse")}
          </label>
          <select
            id="warehouse_id"
            name="warehouse_id"
            value={form.warehouse_id}
            onChange={change}
            className="h-[42px] w-full border border-gray-400 bg-white px-3 text-[13px] outline-none"
          >
            <option value="">{t("allWarehouses")}</option>
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
            checked={form.is_active}
            onChange={change}
            className="h-4 w-4"
          />
          <span>
            <span className="block text-[13px] font-semibold">
              {t("active")}
            </span>
            <span className="mt-1 block text-[11px] text-black/50">
              {t("userActiveDescription")}
            </span>
          </span>
        </label>
      </div>
      <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-[42px] border border-gray-400 bg-white px-5 text-[13px] font-semibold"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex h-[42px] items-center gap-2 border border-[#087c1e] bg-[#099323] px-5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          <Save size={17} />
          {saving ? t("saving") : t(editing ? "saveChanges" : "createUser")}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, ...props }) {
  return (
    <div>
      <label
        htmlFor={props.name}
        className="mb-2 block text-[12px] font-semibold"
      >
        {label}
        {props.required && <span className="ml-1 text-red-600">*</span>}
      </label>
      <input
        {...props}
        id={props.name}
        className="h-[42px] w-full border border-gray-400 bg-white px-3 text-[13px] outline-none"
      />
      {hint && <p className="mt-1 text-[11px] text-black/50">{hint}</p>}
    </div>
  );
}
