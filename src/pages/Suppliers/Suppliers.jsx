import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import {
  deleteSupplier,
  getSupplier,
  getSuppliers,
  setSupplierActive,
} from "../../api/supplier.model";
import { useLanguage } from "../../i18n/LanguageContext";
import ErrorMessage from "../../components/ui/ErrorMessage";
import Modal from "../../components/ui/Modal";
import SupplierForm from "./SupplierForm";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { formatMoney } from "../../utils/formatters";
import DataExchangeDialog from "../../components/data-exchange/DataExchangeDialog";
import { exportData } from "../../api/data-exchange.model";
import { getRuntimeSettings } from "../../utils/runtimeSettings";

const defaults = () => ({ search: "", status: "active", page: 1, limit: Number(getRuntimeSettings().default_page_size || 25) });

export default function Suppliers({ session }) {
  const { t } = useLanguage();
  const canManage = ["admin", "manager"].includes(session?.user?.role);
  const [mode, setMode] = useState("list");
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(defaults);
  const [data, setData] = useState({
    suppliers: [],
    pagination: { page: 1, total: 0, total_pages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(filters.search);

  async function load() {
    try {
      setLoading(true);
      setError("");
      setData(await getSuppliers(filters));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [debouncedSearch, filters.status, filters.page, filters.limit]);

  async function edit(id) {
    try {
      setSelected(await getSupplier(id));
      setMode("form");
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggle(item) {
    try {
      await setSupplierActive(item.id, !item.is_active);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    if (deletingId != null) return;
    try {
      setError("");
      setDeletingId(item.id);
      await deleteSupplier(item.id);
      if (data.suppliers.length === 1 && filters.page > 1)
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      else await load();
    } catch (err) {
      if (!String(err.message || "").includes("Supplier not found"))
        setError(err.message);
    } finally {
      setDeletingId(null);
      setSupplierToDelete(null);
    }
  }
  function requestDelete(item) {
    if (getRuntimeSettings().confirm_destructive_actions) setSupplierToDelete(item);
    else remove(item);
  }

  function list(refresh = false) {
    setMode("list");
    setSelected(null);
    if (refresh) load();
  }

  return (
    <div className="flex h-full flex-col bg-[#f5f7f5]">
      <main className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-[1500px]">
          {mode === "form" ? (
            <SupplierForm
              supplier={selected}
              onCancel={() => list()}
              onSaved={() => list(true)}
            />
          ) : (
            <section className="border border-gray-300 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center bg-[#fff4df] text-[#b86e00]">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h1 className="text-[17px] font-bold">{t("suppliers")}</h1>
                    <p className="mt-1 text-[12px] text-black/55">
                      {t("suppliersDescription")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportData("suppliers", { search: filters.search, status: filters.status }).catch((reason) => setError(reason.message))}
                    className="flex h-[42px] items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"
                  >
                    <Download size={17} />
                    {t("exportData")}
                  </button>
                {canManage && (<>
                  <button
                    type="button"
                    onClick={() => setExchangeOpen(true)}
                    className="flex h-[42px] items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"
                  >
                    <Upload size={17} />
                    {t("importData")}
                  </button>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setMode("form");
                    }}
                    className="flex h-[42px] items-center gap-2 border border-[#087c1e] bg-[#099323] px-4 text-[13px] font-semibold text-white"
                  >
                    <Plus size={18} />
                    {t("addSupplier")}
                  </button>
                </>)}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 border-b border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_220px]">
                <label className="relative">
                  <Search
                    size={16}
                    className="absolute start-3 top-[13px] text-black/45"
                  />
                  <input
                    value={filters.search}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        search: event.target.value,
                        page: 1,
                      }))
                    }
                    placeholder={t("searchSuppliers")}
                    className="h-[42px] w-full border border-gray-400 bg-white ps-9 pe-3 text-[12px] outline-none"
                  />
                </label>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value,
                      page: 1,
                    }))
                  }
                  className="h-[42px] border border-gray-400 bg-white px-3 text-[12px]"
                >
                  <option value="active">{t("active")}</option>
                  <option value="inactive">{t("inactive")}</option>
                  <option value="all">{t("all")}</option>
                </select>
              </div>
              <ErrorMessage message={error} onClose={() => setError("")} />
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right">
                  <thead>
                    <tr className="h-11 border-b border-gray-300 bg-gray-50">
                      <Th>{t("supplier")}</Th>
                      <Th>{t("phoneNumber")}</Th>
                      <Th>{t("emailAddress")}</Th>
                      <Th>{t("taxId")}</Th>
                      <Th>{t("businessActivity")}</Th>
                      <Th>{t("balance")}</Th>
                      <Th>{t("status")}</Th>
                      <Th>{t("action")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="h-32 text-center text-[13px] text-black/50">
                          {t("loadingSuppliers")}
                        </td>
                      </tr>
                    ) : !data.suppliers.length ? (
                      <tr>
                        <td colSpan="8" className="h-40 text-center text-[13px] text-black/50">
                          <Truck size={24} className="mx-auto mb-3" />
                          {t("noSuppliers")}
                        </td>
                      </tr>
                    ) : (
                      data.suppliers.map((item) => (
                        <tr key={item.id} className="h-12 border-b border-gray-200">
                          <td className="px-5 text-[13px] font-semibold">{item.name}</td>
                          <Td>{item.phone || "-"}</Td>
                          <Td>{item.email || "-"}</Td>
                          <Td>{item.nif || "-"}</Td>
                          <Td>{item.business_activity || "-"}</Td>
                          <Td>
                            <span className={Number(item.current_balance) < 0 ? "font-semibold text-blue-700" : "font-semibold"}>
                              {Number(item.current_balance) > 0
                                ? `${t("supplierDebt")}: `
                                : Number(item.current_balance) < 0
                                  ? `${t("availableCredit")}: `
                                  : `${t("settledAccount")}: `}
                              {formatMoney(item.current_balance)}
                            </span>
                          </Td>
                          <Td>
                            <span className={item.is_active ? "text-green-700" : "text-black/45"}>
                              {t(item.is_active ? "active" : "inactive")}
                            </span>
                          </Td>
                          <Td>
                            {canManage ? (
                              <div className="inline-flex items-center gap-2 whitespace-nowrap">
                                <button
                                  onClick={() => edit(item.id)}
                                  className="inline-flex h-[30px] items-center justify-center border border-gray-400 px-3 text-[11px] font-semibold"
                                >
                                  {t("edit")}
                                </button>
                                <button
                                  onClick={() => toggle(item)}
                                  className={`inline-flex h-[30px] items-center justify-center border px-3 text-[11px] font-semibold ${item.is_active ? "border-red-300 text-red-700" : "border-green-300 text-green-700"}`}
                                >
                                  {t(item.is_active ? "deactivate" : "activate")}
                                </button>
                                <button
                                  onClick={() => requestDelete(item)}
                                  disabled={deletingId === item.id}
                                  title={t("delete")}
                                  aria-label={t("delete")}
                                  className="inline-flex h-[30px] items-center justify-center border border-red-400 px-3 text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            ) : (
                              "-"
                            )}
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
                <button
                  disabled={data.pagination.page <= 1}
                  onClick={() => setFilters((current) => ({ ...current, page: data.pagination.page - 1 }))}
                  className="flex h-8 w-8 items-center justify-center border border-gray-400 disabled:opacity-30"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="min-w-20 py-2 text-center text-[11px]">
                  {data.pagination.page} / {data.pagination.total_pages}
                </span>
                <button
                  disabled={data.pagination.page >= data.pagination.total_pages}
                  onClick={() => setFilters((current) => ({ ...current, page: data.pagination.page + 1 }))}
                  className="flex h-8 w-8 items-center justify-center border border-gray-400 disabled:opacity-30"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
      <Modal
        open={Boolean(supplierToDelete)}
        title={t("deleteSupplier")}
        onClose={() => !deletingId && setSupplierToDelete(null)}
        width="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSupplierToDelete(null)}
              disabled={Boolean(deletingId)}
              className="h-9 border border-gray-400 px-4 text-[12px] font-semibold disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => remove(supplierToDelete)}
              disabled={Boolean(deletingId)}
              className="h-9 border border-red-700 bg-red-700 px-4 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {deletingId ? t("deleting") : t("delete")}
            </button>
          </>
        }
      >
        <div className="p-5 text-[13px] leading-6 text-black/75">
          {t("confirmDeleteSupplier")}
        </div>
      </Modal>
      <DataExchangeDialog
        open={exchangeOpen}
        entity="suppliers"
        title={t("importSuppliers")}
        onClose={() => setExchangeOpen(false)}
        onImported={load}
      />
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 text-[12px] font-semibold first:px-5">{children}</th>;
}
function Td({ children }) {
  return <td className="px-4 text-[12px]">{children}</td>;
}
