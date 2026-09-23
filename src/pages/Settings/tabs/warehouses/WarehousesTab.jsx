import { useEffect, useState } from "react";
import { Warehouse, Plus, RefreshCw } from "lucide-react";

import { getWarehouses } from "../../../../api/warehouse.model";
import { WarehouseForm } from "./WarehouseForm";
import { useLanguage } from "../../../../i18n/LanguageContext";

export default function WarehousesTab() {
  const { t } = useLanguage();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);

  async function loadWarehouses() {
    try {
      setLoading(true);
      setError("");

      const data = await getWarehouses();

      setWarehouses(data);
    } catch (err) {
      setError(err.message || t("loadWarehousesFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  function handleAdd() {
    setSelectedWarehouse(null);
    setShowForm(true);
  }

  function handleEdit(warehouse) {
    setSelectedWarehouse(warehouse);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setSelectedWarehouse(null);
  }

  async function handleSaved() {
    setShowForm(false);
    setSelectedWarehouse(null);

    await loadWarehouses();
  }

  return (
    <>
      {/* FORM */}
      {showForm && (
        <WarehouseForm
          warehouse={selectedWarehouse}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />
      )}

      {/* WAREHOUSE LIST */}
      {!showForm && (
        <div className="border border-gray-300 bg-white">
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]">
                <Warehouse size={20} strokeWidth={1.9} />
              </div>

              <div>
                <h2 className="text-[17px] font-bold">{t("warehouses")}</h2>

                <p className="mt-1 text-[12px] text-black/55">
                  {t("warehousesDescription")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* REFRESH */}
              <button
                type="button"
                onClick={loadWarehouses}
                disabled={loading}
                className="
                  flex h-[42px]
                  items-center gap-2
                  border border-gray-400
                  bg-white
                  px-4
                  text-[13px]
                  font-semibold
                  text-black
                  disabled:opacity-50
                "
              >
                <RefreshCw size={17} strokeWidth={1.9} />
                {t("refresh")}
              </button>

              {/* ADD */}
              <button
                type="button"
                onClick={handleAdd}
                className="
                  flex h-[42px]
                  items-center gap-2
                  border border-[#087c1e]
                  bg-[#099323]
                  px-4
                  text-[13px]
                  font-semibold
                  text-white
                "
              >
                <Plus size={18} strokeWidth={2} />
                {t("addWarehouse")}
              </button>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-[13px] font-medium text-red-700">
              {error}
            </div>
          )}

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="h-[44px] border-b border-gray-300 bg-gray-50">
                  <th className="px-5 text-[12px] font-semibold text-black">
                    {t("name")}
                  </th>

                  <th className="px-4 text-[12px] font-semibold text-black">
                    {t("phone")}
                  </th>

                  <th className="px-4 text-[12px] font-semibold text-black">
                    {t("email")}
                  </th>

                  <th className="px-4 text-[12px] font-semibold text-black">
                    {t("nif")}
                  </th>

                  <th className="px-4 text-[12px] font-semibold text-black">
                    {t("selling")}
                  </th>

                  <th className="px-4 text-[12px] font-semibold text-black">
                    {t("status")}
                  </th>

                  <th className="w-[90px] px-4 text-right text-[12px] font-semibold text-black">
                    {t("action")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="h-[120px] text-center text-[13px] text-black/50"
                    >
                      {t("loadingWarehouses")}
                    </td>
                  </tr>
                ) : warehouses.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="h-[160px] text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex h-11 w-11 items-center justify-center bg-gray-100 text-black/45">
                          <Warehouse size={21} strokeWidth={1.8} />
                        </div>

                        <p className="mt-3 text-[13px] font-semibold">
                          {t("noWarehouses")}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  warehouses.map((warehouse) => (
                    <tr
                      key={warehouse.id}
                      className="h-[48px] border-b border-gray-200"
                    >
                      {/* NAME */}
                      <td className="px-5 text-[13px] font-semibold">
                        {warehouse.name}
                      </td>

                      {/* PHONE */}
                      <td className="px-4 text-[13px]">
                        {warehouse.phone || "—"}
                      </td>

                      {/* EMAIL */}
                      <td className="px-4 text-[13px]">
                        {warehouse.email || "—"}
                      </td>

                      {/* NIF */}
                      <td className="px-4 text-[13px]">
                        {warehouse.nif || "—"}
                      </td>

                      {/* CAN SELL */}
                      <td className="px-4 text-[13px]">
                        {t(warehouse.can_sell ? "yes" : "no")}
                      </td>

                      {/* STATUS */}
                      <td className="px-4">
                        <span
                          className={`
                            inline-flex h-[26px]
                            items-center
                            border px-2
                            text-[11px]
                            font-semibold
                            ${
                              warehouse.is_active
                                ? "border-green-300 bg-green-50 text-green-700"
                                : "border-gray-300 bg-gray-100 text-black/55"
                            }
                          `}
                        >
                          {t(warehouse.is_active ? "active" : "inactive")}
                        </span>
                      </td>

                      {/* EDIT */}
                      <td className="px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleEdit(warehouse)}
                          className="
                            h-[30px]
                            border border-gray-400
                            bg-white
                            px-3
                            text-[12px]
                            font-semibold
                            text-black
                          "
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
        </div>
      )}
    </>
  );
}
