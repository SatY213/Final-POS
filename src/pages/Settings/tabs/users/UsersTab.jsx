import { useEffect, useState } from "react";
import { Plus, RefreshCw, Users } from "lucide-react";
import { getUsers } from "../../../../api/user.model";
import { getWarehouses } from "../../../../api/warehouse.model";
import { useLanguage } from "../../../../i18n/LanguageContext";
import UserForm from "./UserForm";

export default function UsersTab() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    try {
      setLoading(true);
      setError("");
      const [userData, warehouseData] = await Promise.all([
        getUsers(),
        getWarehouses(),
      ]);
      setUsers(userData);
      setWarehouses(warehouseData);
    } catch (err) {
      setError(err.message || t("loadUsersFailed"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  if (showForm)
    return (
      <UserForm
        user={selected}
        warehouses={warehouses}
        onCancel={() => {
          setSelected(null);
          setShowForm(false);
        }}
        onSaved={async () => {
          setSelected(null);
          setShowForm(false);
          await load();
        }}
      />
    );
  return (
    <section className="border border-gray-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-[17px] font-bold">{t("users")}</h2>
            <p className="mt-1 text-[12px] text-black/55">
              {t("usersDescription")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex h-[42px] items-center gap-2 border border-gray-400 px-4 text-[13px] font-semibold"
          >
            <RefreshCw size={17} />
            {t("refresh")}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex h-[42px] items-center gap-2 border border-[#087c1e] bg-[#099323] px-4 text-[13px] font-semibold text-white"
          >
            <Plus size={18} />
            {t("addUser")}
          </button>
        </div>
      </div>
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left rtl:text-right">
          <thead>
            <tr className="h-[44px] border-b border-gray-300 bg-gray-50">
              <th className="px-5 text-[12px] font-semibold text-black">
                {t("name")}
              </th>
              <th className="px-4 text-[12px] font-semibold text-black">
                {t("username")}
              </th>
              <th className="px-4 text-[12px] font-semibold text-black">
                {t("role")}
              </th>
              <th className="px-4 text-[12px] font-semibold text-black">
                {t("warehouse")}
              </th>
              <th className="px-4 text-[12px] font-semibold text-black">
                {t("status")}
              </th>
              <th className="px-4 text-right text-[12px] font-semibold text-black rtl:text-left">
                {t("action")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="6"
                  className="h-[120px] text-center text-[13px] text-black/50"
                >
                  {t("loadingUsers")}
                </td>
              </tr>
            ) : !users.length ? (
              <tr>
                <td
                  colSpan="6"
                  className="h-[150px] text-center text-[13px] font-semibold"
                >
                  {t("noUsers")}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="h-[48px] border-b border-gray-200">
                  <td className="px-5 text-[13px] font-semibold">
                    {user.name}
                  </td>
                  <td className="px-4 text-[13px]">{user.username}</td>
                  <td className="px-4 text-[13px] capitalize">
                    {t(`role_${user.role}`)}
                  </td>
                  <td className="px-4 text-[13px]">
                    {user.warehouse_name || t("allWarehouses")}
                  </td>
                  <td className="px-4">
                    <span
                      className={`inline-flex h-[26px] items-center border px-2 text-[11px] font-semibold ${user.is_active ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 bg-gray-100 text-black/55"}`}
                    >
                      {t(user.is_active ? "active" : "inactive")}
                    </span>
                  </td>
                  <td className="px-4 text-right rtl:text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(user);
                        setShowForm(true);
                      }}
                      className="h-[30px] border border-gray-400 px-3 text-[12px] font-semibold"
                    >
                      {t("edit")}
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
