import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter as FilterIcon,
  FileText,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";

import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import ErrorMessage from "../../components/ui/ErrorMessage";
import InvoicePrintDialog from "../Invoices/InvoicePrintDialog";

import useDebouncedValue from "../../hooks/useDebouncedValue";

import { searchPosCustomers } from "../../api/pos.model";

import {
  getSaleDetail,
  getSales,
  getSalesOptions,
  getInvoice,
  getInvoices,
  addInvoicePayment,
  getInvoiceContext,
} from "../../api/sales.model";

import {
  addSalePayment,
  createSaleReturn,
  validateDelivery,
  deliverDelivery,
  getSaleReturn,
} from "../../api/commercial.model";

import {
  formatDate,
  formatMoney,
  formatQuantity,
} from "../../utils/formatters";

import { useLanguage } from "../../i18n/LanguageContext";
import SalePrintDialog from "./SalePrintDialog";
import { profileTypeForDocument } from "../../utils/salePrintTemplate";
import Th from "../../components/ui/Th";
import Td from "../../components/ui/Td";
import BusinessStatusBadge from "../../components/ui/BusinessStatusBadge";
import { ReturnModal } from "../Purchases/Purchases";
import { getRuntimeSettings } from "../../utils/runtimeSettings";
import ExportButton from "../../components/data-exchange/ExportButton";

/* =========================================================
 * FILTERS
 * ========================================================= */

const emptyFilters = () => ({
  search: "",
  from: "",
  to: "",
  customer_id: "",
  seller_id: "",
  payment_method_code: "",
  payment_status: "",
  page: 1,
  limit: Number(getRuntimeSettings().default_page_size || 25),
});

function filtersFromNavigation(initialFilters) {
  const filters = emptyFilters();
  if (!initialFilters) return filters;
  if (initialFilters.period === "today") {
    const today = new Date().toISOString().slice(0, 10);
    filters.from = today;
    filters.to = today;
  }
  for (const key of ["search", "from", "to", "customer_id", "seller_id", "payment_method_code", "payment_status"])
    if (initialFilters[key] != null) filters[key] = initialFilters[key];
  return filters;
}

/* =========================================================
 * SALES PAGE
 * ========================================================= */

export default function Sales({ warehouseId, onNavigate, session, initialFilters = null }) {
  const { t, language } = useLanguage();

  const searchRef = useRef(null);

  const [filters, setFilters] = useState(() => filtersFromNavigation(initialFilters));

  const [data, setData] = useState({
    items: [],
    pagination: {
      page: 1,
      pages: 1,
    },
    summary: {
      count: 0,
      total_amount: 0,
    },
  });

  const [options, setOptions] = useState({
    sellers: [],
    payment_methods: [],
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detail, setDetail] = useState(null);
  const [detailInitialAction, setDetailInitialAction] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [invoiceTarget, setInvoiceTarget] = useState(null);
  const [returning, setReturning] = useState(null);
  const [returnSaving, setReturnSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("sales");

  const debouncedSearch = useDebouncedValue(filters.search);

  const invalidRange = Boolean(
    filters.from && filters.to && filters.from > filters.to,
  );

  function patch(patchValues) {
    setFilters((current) => ({
      ...current,
      ...patchValues,

      // Conserver la page uniquement si elle est explicitement fournie.
      page: patchValues.page !== undefined ? patchValues.page : 1,
    }));
  }

  async function load() {
    if (!warehouseId) return;

    if (filters.from && filters.to && filters.from > filters.to) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const next = await getSales({
        ...filters,
        search: debouncedSearch,
        warehouse_id: warehouseId,
      });

      setData(next);
      setSelectedIndex(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFilters(filtersFromNavigation(initialFilters));

    if (!warehouseId) return;

    getSalesOptions(warehouseId)
      .then(setOptions)
      .catch((e) => setError(e.message));
  }, [warehouseId, initialFilters]);

  useEffect(() => {
    load();
  }, [
    warehouseId,
    debouncedSearch,
    filters.from,
    filters.to,
    filters.customer_id,
    filters.seller_id,
    filters.payment_method_code,
    filters.payment_status,
    filters.page,
    filters.limit,
  ]);

  async function open(item = data.items[selectedIndex]) {
    if (!item) return;

    try {
      setError("");
      setDetail(await getSaleDetail(item.id));
    } catch (e) {
      setError(e.message);
    }
  }
  async function runRowAction(item, action) {
    try {
      setError("");
      setRowMenu(null);
      const sale = await getSaleDetail(item.id);
      if (action === "print") setPrintTarget(sale);
      if (action === "direct-print") {
        const documentType =
          sale.document_type === "TICKET" ? "TICKET" : "BON_POUR";
        const profile =
          (sale.print_profiles || []).find(
            (entry) =>
              entry.document_type === profileTypeForDocument(documentType),
          ) || sale.print_profile;
        await window.electronAPI?.printSale?.(sale, {
          ...profile,
          document_type: documentType,
        });
      }
      if (action === "edit")
        onNavigate?.("pos", { editSale: sale, mode: "SALE" });
      if (action === "return") openReturn(sale);
      if (action === "payment") {
        setDetailInitialAction("payment");
        setDetail(sale);
      }
      if (action === "delivery") {
        setDetail(sale);
      }
      if (action === "invoice") {
        if (sale.invoice) setInvoiceTarget(await getInvoice(sale.invoice.id));
        else onNavigate?.("invoice-builder", { saleId: sale.id });
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function openReturn(sale) {
    const returnable = (sale.lines || []).filter(
      (line) => Number(line.returnable_quantity) > 0,
    );
    if (!returnable.length) {
      setError("All items from this sale have already been returned");
      return;
    }
    const historicalLinesTotal = (sale.lines || []).reduce(
        (sum, line) => sum + Number(line.total || 0),
        0,
      ),
      returnFactor = historicalLinesTotal > 0
        ? Number(sale.total) / historicalLinesTotal
        : 1;
    setReturning({
      ...sale,
      settlement_mode: "CUSTOMER_CREDIT",
      refund_payment_method_code:
        options.payment_methods.find((method) => method.affects_cash_drawer)
          ?.code || "CASH",
      lines: returnable.map((line) => ({
        ...line,
        selected_quantity: 0,
        return_unit_total:
          (Number(line.total || 0) / Number(line.quantity || 1)) *
          returnFactor,
      })),
    });
  }

  async function saveSaleReturn() {
    try {
      setReturnSaving(true);
      setError("");
      const returnAmount = returning.lines.reduce(
        (sum, line) =>
          sum +
          Number(line.selected_quantity || 0) *
            Number(line.return_unit_total ?? line.unit_price ?? 0),
        0,
      );
      await createSaleReturn(returning.id, {
        client_request_id: `sale-return:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
        return_date: new Date().toISOString().slice(0, 10),
        settlement_mode: returning.settlement_mode || "CUSTOMER_CREDIT",
        refund_payment_method_code: returning.refund_payment_method_code,
        refund_amount:
          returning.settlement_mode === "REFUND" ? returnAmount : undefined,
        lines: returning.lines
          .filter((line) => Number(line.selected_quantity) > 0)
          .map((line) => ({
            sale_line_id: line.id,
            quantity: Number(line.selected_quantity),
          })),
      });
      setReturning(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setReturnSaving(false);
    }
  }

  useEffect(() => {
    const handler = (event) => {
      if (
        detail ||
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)
      ) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();

        setSelectedIndex((index) =>
          Math.min(Math.max(data.items.length - 1, 0), index + 1),
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();

        setSelectedIndex((index) => Math.max(0, index - 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        open();
      } else if (event.key === "F1") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "F6") {
        event.preventDefault();
        setFilterOpen(true);
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [detail, data.items, selectedIndex]);

  useEffect(() => {
    if (!rowMenu) return;
    const close = (event) => {
      if (!event.target.closest("[data-sales-row-menu]")) setRowMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [rowMenu]);

  if (activeView === "invoices")
    return (
      <InvoicesView
        warehouseId={warehouseId}
        onNavigate={onNavigate}
        onBack={() => setActiveView("sales")}
        language={language}
        t={t}
      />
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f6f5]">
      <main className="min-h-0 flex-1 overflow-hidden p-4 lg:p-5">
        <section className="mx-auto flex h-full min-h-0 max-w-[1500px] flex-col overflow-hidden border border-gray-300 bg-white shadow-sm">
          {/* =================================================
           * HEADER
           * ================================================= */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]">
                <ShoppingBag size={20} />
              </div>
              <div>
                <h2 className="text-[17px] font-bold">{t("salesHistory")}</h2>
                <p className="mt-1 text-[12px] text-black/55">
                  {t("salesHistoryDescription")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                entity="sales"
                query={{ ...filters, search: debouncedSearch, warehouse_id: warehouseId }}
                onError={setError}
              />
              <Button icon={FileText} onClick={() => setActiveView("invoices")}>
                {t("invoices")}
              </Button>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => onNavigate?.("pos", { mode: "SALE" })}
              >
                {t("Nouvelle vente")}
              </Button>
              <Button
                variant="primary"
                icon={FileText}
                onClick={() => onNavigate?.("invoice-builder")}
              >
                {t("Nouvelle facture")}
              </Button>
            </div>
          </div>
          {/* =================================================
           * SEARCH TOOLBAR
           * ================================================= */}

          <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-500"
              />

              <input
                ref={searchRef}
                value={filters.search}
                onChange={(e) =>
                  patch({
                    search: e.target.value,
                  })
                }
                placeholder={t("searchSales")}
                className="
                  h-[42px]
                  w-full
                  border
                  border-gray-400
                  bg-white
                  ps-9
                  pe-3
                  text-[12px]
                  font-medium
                  text-gray-950
                  outline-none
                  transition
                  placeholder:text-gray-500
                  focus:border-gray-700
                  focus:ring-1
                  focus:ring-gray-300
                "
              />
            </div>

            <Button
              icon={FilterIcon}
              onClick={() => setFilterOpen(true)}
              className="flex h-[42px] shrink-0 items-center justify-center"
            >
              <span>{t("filters")}</span>

              <span className="ms-1 text-[10px] font-semibold text-gray-500">
                F6
              </span>
            </Button>
          </div>

          {/* =================================================
           * FILTER MODAL
           * ================================================= */}

          {filterOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4">
              <div className="flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden border border-gray-300 bg-white shadow-2xl">
                {/* Filter header */}

                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-bold text-gray-950">
                      {t("advancedFilters")}
                    </h2>

                    <p className="mt-1 text-[11px] font-medium text-gray-600">
                      {t("Dates, client, vendeur et moyen de paiement.")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    className="
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      border
                      border-gray-300
                      bg-white
                      text-gray-700
                      transition
                      hover:bg-gray-100
                      hover:text-gray-950
                    "
                    title={t("close")}
                  >
                    <X size={17} />
                  </button>
                </div>

                {/* Filter content */}

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <div
                    className="
                      grid
                      grid-cols-1
                      gap-x-4
                      gap-y-4
                      sm:grid-cols-2
                      lg:grid-cols-3
                    "
                  >
                    <Filter label={t("fromDate")}>
                      <LocalizedDateInput
                        value={filters.from}
                        onChange={(value) => patch({ from: value })}
                        t={t}
                      />
                    </Filter>

                    <Filter label={t("toDate")}>
                      <LocalizedDateInput
                        value={filters.to}
                        onChange={(value) => patch({ to: value })}
                        t={t}
                      />
                    </Filter>

                    <CustomerFilter
                      value={filters.customer_id}
                      onChange={(value) =>
                        patch({
                          customer_id: value,
                        })
                      }
                      t={t}
                    />

                    <Filter label={t("seller")}>
                      <select
                        value={filters.seller_id}
                        onChange={(e) =>
                          patch({
                            seller_id: e.target.value,
                          })
                        }
                        className={controlClassName}
                      >
                        <option value="">{t("allSellers")}</option>

                        {options.sellers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Filter>

                    <Filter label={t("paymentMethod")}>
                      <select
                        value={filters.payment_method_code}
                        onChange={(e) =>
                          patch({
                            payment_method_code: e.target.value,
                          })
                        }
                        className={controlClassName}
                      >
                        <option value="">{t("allPaymentMethods")}</option>

                        {options.payment_methods.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Filter>
                  </div>
                </div>

                {/* Filter footer */}

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setFilters(emptyFilters())}
                    className="
                      flex
                      h-[40px]
                      items-center
                      justify-center
                      gap-2
                      border
                      border-gray-300
                      bg-white
                      px-4
                      text-[12px]
                      font-semibold
                      text-gray-700
                      transition
                      hover:border-gray-400
                      hover:bg-gray-100
                      hover:text-gray-950
                    "
                  >
                    <RotateCcw size={15} />

                    {t("reset")}
                  </button>

                  <div className="flex items-center gap-2">
                    <Button onClick={() => setFilterOpen(false)}>
                      {t("cancel")}
                    </Button>

                    <Button
                      variant="primary"
                      onClick={() => setFilterOpen(false)}
                    >
                      {t("apply")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
           * ERROR
           * ================================================= */}

          <ErrorMessage
            message={invalidRange ? t("invalidDateRange") : error}
            type={invalidRange ? "warning" : "error"}
            onClose={() => setError("")}
          />

          {/* =================================================
           * TABLE
           * ================================================= */}

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-[1050px] w-full border-collapse text-left rtl:text-right">
              <thead className="sticky top-0 z-10">
                <tr className="h-11 border-b border-gray-300 bg-gray-100">
                  <Th>{t("N° document")}</Th>

                  <Th>{t("dateTime")}</Th>

                  <Th>{t("type")}</Th>

                  <Th>{t("customer")}</Th>

                  <Th>{t("total")}</Th>

                  <Th>{t("Paiement")}</Th>

                  <Th>{t("delivery")}</Th>

                  <Th>{t("returns")}</Th>

                  <Th>{t("invoicingSettings")}</Th>

                  <Th right>{t("action")}</Th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <Empty colSpan="10">{t("loadingSales")}</Empty>
                ) : !data.items.length ? (
                  <Empty colSpan="10">{t("noFilteredSales")}</Empty>
                ) : (
                  data.items.map((item, index) => {
                    const selected = selectedIndex === index;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedIndex(index)}
                        onDoubleClick={() => open(item)}
                        className={`
                            h-[50px]
                            cursor-pointer
                            border-b
                            border-gray-200
                            transition-colors
                            ${
                              selected
                                ? "bg-green-50"
                                : "bg-white hover:bg-gray-50"
                            }
                          `}
                      >
                        <td className="px-5 text-[13px] font-semibold">
                          {item.document_number}
                        </td>

                        <Td>{formatSaleDateTime(item, language)}</Td>

                        <Td>
                          <DocumentTypeLabel value={item.fulfillment_type} />
                        </Td>

                        <Td>{item.customer_name || t("noCustomer")}</Td>

                        <Td>
                          <td className="font-semibold">
                            {formatMoney(item.total, language)}{" "}
                          </td>
                        </Td>

                        <Td>
                          <Badge value={item.payment_status} />
                        </Td>

                        <Td>
                          {item.fulfillment_type === "SHIPPING" ? (
                            <Badge value={item.delivery_status} />
                          ) : (
                            <MutedDash />
                          )}
                        </Td>

                        <Td>
                          <Badge value={item.return_status} />
                        </Td>
                        <Td>
                          {item.invoice_id ? (
                            <span className="font-semibold text-[#087c1e]">
                              {t("Facturé ·")} {item.invoice_number}
                            </span>
                          ) : (
                            <span className="text-black/50">{t("Non facturé")}</span>
                          )}
                        </Td>
                        <td
                          data-sales-row-menu
                          className="relative px-4 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setRowMenu((current) =>
                                current === item.id ? null : item.id,
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center border border-gray-400 bg-white"
                            aria-label={t("moreActions")}
                          >
                            <MoreHorizontal size={17} />
                          </button>
                          {rowMenu === item.id && (
                            <div className="absolute right-4 top-10 z-30 min-w-[180px] border border-gray-300 bg-white p-1 text-left shadow-lg rtl:left-4 rtl:right-auto rtl:text-right">
                              <button
                                type="button"
                                onClick={() => runRowAction(item, "print")}
                                className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
                              >
                                {t("reprint")}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  runRowAction(item, "direct-print")
                                }
                                className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
                              >
                                {t("Imprimer directement")}
                              </button>
                              {item.sale_status !== "CANCELLED" && (
                                <button
                                  type="button"
                                  onClick={() => runRowAction(item, "invoice")}
                                  className="block h-9 w-full px-3 text-left text-[12px] font-semibold text-[#087c1e] hover:bg-green-50 rtl:text-right"
                                >
                                  {item.invoice_id
                                    ? t("Voir la facture")
                                    : "Facturer"}
                                </button>
                              )}
                              {["admin", "manager"].includes(
                                session?.user?.role,
                              ) &&
                                item.sale_status === "CONFIRMED" &&
                                Number(item.balance_due) > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      runRowAction(item, "payment")
                                    }
                                    className="block h-9 w-full px-3 text-left text-[12px] font-semibold text-blue-700 hover:bg-blue-50 rtl:text-right"
                                  >
                                    {t("addPayment")}
                                  </button>
                                )}
                              {session?.user?.role &&
                                ["admin", "manager"].includes(
                                  session.user.role,
                                ) &&
                                item.sale_status !== "CANCELLED" && (
                                  <button
                                    type="button"
                                    onClick={() => runRowAction(item, "edit")}
                                    className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
                                  >
                                    {t("modify")}
                                  </button>
                                )}
                              {item.fulfillment_type === "SHIPPING" && (
                                <button
                                  type="button"
                                  onClick={() => runRowAction(item, "delivery")}
                                  className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
                                >
                                  {t("Changer le statut de livraison")}
                                </button>
                              )}
                              {session?.user?.role &&
                                ["admin", "manager"].includes(
                                  session.user.role,
                                ) &&
                                item.return_status !== "FULLY_RETURNED" && (
                                  <button
                                    type="button"
                                    onClick={() => runRowAction(item, "return")}
                                    className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
                                  >
                                    {t("createReturn")}
                                  </button>
                                )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* =================================================
           * FOOTER
           * ================================================= */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-3">
            <div className="min-w-0 text-[11px] text-black">
              {data.summary.count} {t("salesCount")}
              <span className="ms-6 font-semibold">
                {t("CA brut")}{" "}
                <b className="font-bold text-gray-950">
                  {formatMoney(data.summary.gross_amount, language)}
                </b>
              </span>
              <span className="ms-6 font-semibold">
                {t("returns")}{" "}
                <b className="font-bold text-red-700">
                  -{formatMoney(data.summary.return_amount, language)}
                </b>
              </span>
              <span className="ms-6 font-semibold">
                {t("CA net")}{" "}
                <b className="font-bold text-[#087c1e]">
                  {formatMoney(data.summary.net_amount, language)}
                </b>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filters.limit}
                onChange={(event) =>
                  patch({ limit: Number(event.target.value) })
                }
                className="h-8 border border-gray-400 bg-white px-2 text-[11px]"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <button
                type="button"
                disabled={data.pagination.page <= 1}
                onClick={() => patch({ page: data.pagination.page - 1 })}
                className="flex h-8 w-8 items-center justify-center border border-gray-400 disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="min-w-[72px] text-center text-[11px] font-semibold">
                {data.pagination.page} / {data.pagination.pages}
              </span>
              <button
                type="button"
                disabled={data.pagination.page >= data.pagination.pages}
                onClick={() => patch({ page: data.pagination.page + 1 })}
                className="flex h-8 w-8 items-center justify-center border border-gray-400 disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================
       * SALE DETAIL
       * ===================================================== */}

      <SalePrintDialog
        sale={printTarget}
        onClose={() => setPrintTarget(null)}
        setError={setError}
      />
      <ReturnModal
        receipt={returning}
        setReceipt={setReturning}
        paymentMethods={options.payment_methods}
        onClose={() => !returnSaving && setReturning(null)}
        onSave={saveSaleReturn}
        saving={returnSaving}
        partyType="customer"
      />
      <Modal
        open={!!invoiceTarget}
        title={t("Facture")}
        onClose={() => setInvoiceTarget(null)}
        width="lg"
        footer={<Button onClick={() => setInvoiceTarget(null)}>{t("close")}</Button>}
      >
        {invoiceTarget && (
          <div className="space-y-4 p-5 text-[12px]">
            <div className="grid gap-3 border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3">
              <Info label={t("invoiceNumber")} value={invoiceTarget.invoice_number} />
              <Info
                label={t("date")}
                value={formatDate(invoiceTarget.invoice_date, language)}
              />
              <Info
                label={t("customer")}
                value={invoiceTarget.customer_name || t("noCustomer")}
              />
            </div>
            <div className="border border-gray-200">
              {(invoiceTarget.sales || []).map((sale) => (
                <div
                  key={sale.id}
                  className="flex justify-between border-b border-gray-200 p-3 last:border-0"
                >
                  <span>
                    <b>{sale.sale_number}</b> ·{" "}
                    {sale.document_type === "TICKET" ? "Ticket" : t("Bon pour")}
                  </span>
                  <b>{formatMoney(sale.amount, language)}</b>
                </div>
              ))}
            </div>
            <div className="text-right text-[18px] font-bold">
              {t("Total :")} {formatMoney(invoiceTarget.total, language)}
            </div>
          </div>
        )}
      </Modal>
      <SaleDetail
        sale={detail}
        onClose={() => {
          setDetail(null);
          setDetailInitialAction(null);
        }}
        language={language}
        t={t}
        setError={setError}
        onChanged={async () => {
          const next = await getSaleDetail(detail.id);

          setDetail(next);

          load();
        }}
        canManageCommercial={["admin", "manager"].includes(session?.user?.role)}
        initialAction={detailInitialAction}
      />
    </div>
  );
}

function InvoicesView({ warehouseId, onNavigate, onBack, language, t }) {
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [detail, setDetail] = useState(null),
    [printTarget, setPrintTarget] = useState(null),
    [invoiceMenu, setInvoiceMenu] = useState(null),
    [paymentTarget, setPaymentTarget] = useState(null),
    [paymentMethods, setPaymentMethods] = useState([]),
    [paymentForm, setPaymentForm] = useState({
      amount: "",
      payment_method_code: "",
      reference: "",
    }),
    [paymentSaving, setPaymentSaving] = useState(false);
  const debounced = useDebouncedValue(query);
  useEffect(() => {
    if (!warehouseId) return;
    setLoading(true);
    getInvoices({ warehouse_id: warehouseId, search: debounced, limit: 100 })
      .then((data) => setRows(data.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [warehouseId, debounced]);
  async function openInvoice(id) {
    try {
      setDetail(await getInvoice(id));
    } catch (e) {
      setError(e.message);
    }
  }
  async function previewInvoice(id) {
    try {
      setInvoiceMenu(null);
      setPrintTarget(await getInvoice(id));
    } catch (e) {
      setError(e.message);
    }
  }
  async function printInvoice(id) {
    try {
      setInvoiceMenu(null);
      const invoice = await getInvoice(id);
      await window.electronAPI?.printDocument?.(invoice, invoice.print_profile);
    } catch (e) {
      setError(e.message);
    }
  }
  async function openInvoicePayment(invoice) {
    try {
      const context = await getInvoiceContext(warehouseId);
      setPaymentMethods(context.payment_methods || []);
      setPaymentForm({
        amount: invoice.balance_due,
        payment_method_code: context.payment_methods?.[0]?.code || "",
        reference: "",
      });
      setPaymentTarget(invoice);
      setInvoiceMenu(null);
    } catch (e) {
      setError(e.message);
    }
  }
  async function saveInvoicePayment() {
    try {
      setPaymentSaving(true);
      const updated = await addInvoicePayment(paymentTarget.id, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
        client_request_id: `invoice-payment:${paymentTarget.id}:${Date.now()}`,
      });
      setPaymentTarget(null);
      setDetail(null);
      const next = await getInvoices({
        warehouse_id: warehouseId,
        search: debounced,
        limit: 100,
      });
      setRows(next.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setPaymentSaving(false);
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f6f5]">
      <ErrorMessage message={error} onClose={() => setError("")} />
      <main className="min-h-0 flex-1 overflow-hidden p-4 lg:p-5">
        <section className="mx-auto flex h-full min-h-0 max-w-[1500px] flex-col overflow-hidden border border-gray-300 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-green-50 text-[#099323]">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-[17px] font-bold">{t("Factures de vente")}</h2>
                <p className="mt-1 text-[12px] text-black/55">
                  {t("Consulter les factures et les ventes regroupées.")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <ExportButton
                entity="customer_invoices"
                query={{ warehouse_id: warehouseId, search: debounced }}
                onError={setError}
              />
              <Button icon={ShoppingBag} onClick={onBack}>
                {t("Ventes")}
              </Button>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => onNavigate?.("pos", { mode: "SALE" })}
              >
                {t("Nouvelle vente")}
              </Button>
              <Button
                variant="primary"
                icon={FileText}
                onClick={() => onNavigate?.("invoice-builder")}
              >
                {t("Nouvelle facture")}
              </Button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Rechercher une facture ou un client...")}
                className="h-[42px] w-full border border-gray-400 bg-white ps-9 pe-3 text-[12px] font-medium outline-none focus:border-gray-700"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-[980px] w-full border-collapse text-left rtl:text-right">
              <thead className="sticky top-0 z-10">
                <tr className="h-11 border-b border-gray-300 bg-gray-100">
                  <Th>{t("invoiceNumber")}</Th>
                  <Th>{t("date")}</Th>
                  <Th>{t("Client")}</Th>
                  <Th>{t("Ventes liées")}</Th>
                  <Th>{t("Total")}</Th>
                  <Th>{t("Déjà payé")}</Th>
                  <Th>{t("remainingToPay")}</Th>
                  <Th>{t("Paiement")}</Th>
                  <Th right>{t("action")}</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <Empty colSpan="9">{t("Chargement des factures...")}</Empty>
                ) : !rows.length ? (
                  <Empty colSpan="9">{t("Aucune facture trouvée")}</Empty>
                ) : (
                  rows.map((invoice) => (
                    <tr
                      key={invoice.id}
                      onDoubleClick={() => openInvoice(invoice.id)}
                      className="h-[50px] cursor-pointer border-b border-gray-200 bg-white hover:bg-green-50"
                    >
                      <td className="px-5 text-[13px] font-bold">
                        {invoice.invoice_number}
                      </td>
                      <Td>{formatDate(invoice.invoice_date, language)}</Td>
                      <Td>{invoice.customer_name || t("noCustomer")}</Td>
                      <Td>
                        <span className="inline-flex min-w-7 justify-center border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800">
                          {invoice.sales?.length || 0}
                        </span>
                      </Td>
                      <Td>
                        <b>{formatMoney(invoice.total, language)}</b>
                      </Td>
                      <Td>{formatMoney(invoice.paid_amount, language)}</Td>
                      <Td>
                        <b
                          className={
                            invoice.balance_due > 0
                              ? "text-amber-700"
                              : "text-green-700"
                          }
                        >
                          {formatMoney(invoice.balance_due, language)}
                        </b>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {invoice.status === "CANCELLED" && (
                            <span className="border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">
                              {t("Annulée")}
                            </span>
                          )}
                          <Badge value={invoice.payment_status} />
                        </div>
                      </Td>
                      <td
                        className="relative px-4 text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setInvoiceMenu((current) =>
                              current === invoice.id ? null : invoice.id,
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center border border-gray-400 bg-white"
                          aria-label={t("moreActions")}
                        >
                          <MoreHorizontal size={17} />
                        </button>
                        {invoiceMenu === invoice.id && (
                          <div className="absolute right-4 top-10 z-30 min-w-[190px] border border-gray-300 bg-white p-1 text-left shadow-lg rtl:left-4 rtl:right-auto rtl:text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setInvoiceMenu(null);
                                openInvoice(invoice.id);
                              }}
                              className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
                            >
                              {t("details")}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onNavigate?.("invoice-builder", {
                                  invoiceId: invoice.id,
                                })
                              }
                              className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
                            >
                              {t("Modifier")}
                            </button>
                            <button
                              type="button"
                              onClick={() => previewInvoice(invoice.id)}
                              className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
                            >
                              {t("Prévisualiser")}
                            </button>
                            <button
                              type="button"
                              onClick={() => printInvoice(invoice.id)}
                              className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
                            >
                              {t("Imprimer directement")}
                            </button>
                            {invoice.status === "ISSUED" &&
                              Number(invoice.balance_due) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openInvoicePayment(invoice)}
                                  className="block h-9 w-full px-3 text-left text-[12px] font-semibold text-blue-700 hover:bg-blue-50 rtl:text-right"
                                >
                                  {t("addPayment")}
                                </button>
                              )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 px-5 py-3 text-[11px] font-semibold">
            {rows.length} {t("facture(s)")}
          </div>
        </section>
      </main>
      <Modal
        open={!!detail}
        title={t("Détail de la facture")}
        onClose={() => setDetail(null)}
        width="xl"
        footer={
          <>
            <Button onClick={() => setDetail(null)}>{t("close")}</Button>
            <Button onClick={() => setPrintTarget(detail)}>
              {t("Prévisualiser")}
            </Button>
            {detail?.balance_due > 0 && (
              <Button onClick={() => openInvoicePayment(detail)}>
                {t("addPayment")}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() =>
                onNavigate?.("invoice-builder", { invoiceId: detail?.id })
              }
            >
              {t("Modifier la facture")}
            </Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4 p-5 text-[11px] text-gray-900">
            <div className="grid gap-3 border bg-gray-50 p-4 sm:grid-cols-3">
              <Info label={t("invoiceNumber")} value={detail.invoice_number} />
              <Info
                label={t("date")}
                value={formatDate(detail.invoice_date, language)}
              />
              <Info
                label={t("customer")}
                value={detail.customer_name || t("noCustomer")}
              />
            </div>
            <section className="border">
              <h3 className="border-b bg-gray-50 px-4 py-3 text-[12px] font-bold">
                {t("Ventes liées (")}{detail.sales?.length || 0})
              </h3>
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b text-[10px] uppercase text-black/50">
                    <th className="px-4 py-2">{t("saleNumber")}</th>
                    <th>{t("Mode")}</th>
                    <th>{t("date")}</th>
                    <th className="text-right">{t("Total vente")}</th>
                    <th className="px-4 text-right">{t("Réglé sur la vente")}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sales?.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b last:border-0 text-[11px]"
                    >
                      <td className="px-4 py-2.5 font-bold text-blue-800">
                        {sale.sale_number}
                      </td>
                      <td>{getDocumentTypeLabel(sale.fulfillment_type)}</td>
                      <td>{formatDate(sale.sale_date, language)}</td>
                      <td className="text-right">
                        {formatMoney(sale.total, language)}
                      </td>
                      <td className="px-4 text-right font-semibold">
                        {formatMoney(sale.sale_paid_amount, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="border">
              <h3 className="border-b bg-gray-50 px-4 py-3 text-[12px] font-bold">
                {t("Articles facturés (")}{detail.lines?.length || 0})
              </h3>
              <div className="max-h-52 overflow-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b text-[10px] uppercase text-black/50">
                      <th className="px-4 py-2">{t("designation")}</th>
                      <th>{t("Vente")}</th>
                      <th>{t("Qté")}</th>
                      <th className="text-right">{t("Prix")}</th>
                      <th className="px-4 text-right">{t("Total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines?.map((line) => (
                      <tr
                        key={line.id}
                        className="border-b last:border-0 text-[11px]"
                      >
                        <td className="px-4 py-2 font-semibold">
                          {line.designation}
                        </td>
                        <td>{line.sale_number}</td>
                        <td>{formatQuantity(line.quantity, language)}</td>
                        <td className="text-right">
                          {formatMoney(line.unit_price, language)}
                        </td>
                        <td className="px-4 text-right font-bold">
                          {formatMoney(line.total, language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {!!detail.payments?.length && (
              <section className="border">
                <h3 className="border-b bg-gray-50 px-4 py-3 text-[12px] font-bold">
                  {t("Paiements ajoutés depuis la facture")}
                </h3>
                {detail.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between border-b px-4 py-2.5 last:border-0"
                  >
                    <span>
                      {payment.payment_method_name} ·{" "}
                      {payment.reference || t("Sans référence")}
                    </span>
                    <b>{formatMoney(payment.amount, language)}</b>
                  </div>
                ))}
              </section>
            )}
            <div className="grid grid-cols-2 gap-x-5 gap-y-3 border border-green-200 bg-green-50 p-4 text-right text-[10px] sm:grid-cols-4 xl:grid-cols-8">
              <span>
                {t("Total HT")}
                <br />
                <b className="text-[12px]">
                  {formatMoney(detail.subtotal, language)}
                </b>
              </span>
              <span>
                {t("discount")}
                <br />
                <b className="text-[12px]">
                  {formatMoney(-Number(detail.discount_amount || 0), language)}
                </b>
              </span>
              <span>
                {t("TVA (")}{Number(detail.tax_rate || 0)}%)
                <br />
                <b className="text-[12px]">
                  {formatMoney(detail.tax_amount, language)}
                </b>
              </span>
              <span>
                {t("Timbre (")}{Number(detail.stamp_rate || 0)}%)
                <br />
                <b className="text-[12px]">
                  {formatMoney(detail.stamp_amount, language)}
                </b>
              </span>
              <span>
                {t("Total TTC")}
                <br />
                <b className="text-[13px]">
                  {formatMoney(detail.total, language)}
                </b>
              </span>
              <span>
                {t("Paiements directs des ventes")}
                <br />
                <b className="text-[12px]">
                  {formatMoney(detail.sales_paid, language)}
                </b>
              </span>
              <span>
                {t("Paiements depuis la facture")}
                <br />
                <b className="text-[12px]">
                  {formatMoney(detail.new_paid, language)}
                </b>
              </span>
              <span>
                {t("paid")}
                <br />
                <b className="text-[12px]">
                  {formatMoney(detail.paid_amount, language)}
                </b>
              </span>
              <span>
                {t("remaining")}
                <br />
                <b className="text-[13px]">
                  {formatMoney(detail.balance_due, language)}
                </b>
              </span>
              {Number(detail.overpaid_amount) > 0 && (
                <span className="text-blue-800">
                  {t("Trop-perçu / crédit")}
                  <br />
                  <b className="text-[13px]">
                    {formatMoney(detail.overpaid_amount, language)}
                  </b>
                </span>
              )}
            </div>
          </div>
        )}
      </Modal>
      <InvoicePrintDialog
        invoice={printTarget}
        onClose={() => setPrintTarget(null)}
        setError={setError}
      />
      <Modal
        open={!!paymentTarget}
        title={t("addPayment")}
        onClose={() => !paymentSaving && setPaymentTarget(null)}
        width="sm"
        footer={
          <>
            <Button onClick={() => setPaymentTarget(null)}>{t("cancel")}</Button>
            <Button
              variant="primary"
              disabled={
                paymentSaving ||
                !(Number(paymentForm.amount) > 0) ||
                Number(paymentForm.amount) >
                  Number(paymentTarget?.balance_due || 0)
              }
              onClick={saveInvoicePayment}
            >
              {paymentSaving ? "Enregistrement..." : "Valider le paiement"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 p-5">
          <label className="block text-[12px] font-semibold">
            {t("Montant")}
            <input
              type="number"
              min="0"
              max={paymentTarget?.balance_due || 0}
              step="0.01"
              value={paymentForm.amount}
              onChange={(event) =>
                setPaymentForm({ ...paymentForm, amount: event.target.value })
              }
              className="mt-1 h-10 w-full border border-gray-400 px-3"
            />
          </label>
          <label className="block text-[12px] font-semibold">
            {t("paymentMethod")}
            <select
              value={paymentForm.payment_method_code}
              onChange={(event) =>
                setPaymentForm({
                  ...paymentForm,
                  payment_method_code: event.target.value,
                })
              }
              className="mt-1 h-10 w-full border border-gray-400 px-3"
            >
              {paymentMethods.map((method) => (
                <option key={method.code} value={method.code}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-semibold">
            {t("reference")}
            <input
              value={paymentForm.reference}
              onChange={(event) =>
                setPaymentForm({
                  ...paymentForm,
                  reference: event.target.value,
                })
              }
              className="mt-1 h-10 w-full border border-gray-400 px-3"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}

/* =========================================================
 * CUSTOMER FILTER
 * ========================================================= */

function CustomerFilter({ value, onChange, t }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);

  const debounced = useDebouncedValue(query);

  useEffect(() => {
    if (debounced.trim()) {
      searchPosCustomers(debounced)
        .then(setItems)
        .catch(() => setItems([]));
    } else {
      setItems([]);
    }
  }, [debounced]);

  return (
    <Filter label={t("customer")}>
      <div className="relative min-w-0">
        <input
          value={query}
          onChange={(e) => {
            const next = e.target.value;

            setQuery(next);

            if (!next) {
              onChange("");
            }
          }}
          placeholder={value ? t("customerSelected") : t("allCustomers")}
          className={controlClassName}
        />

        {items.length > 0 && (
          <div
            className="
              absolute
              start-0
              top-[calc(100%+4px)]
              z-30
              max-h-52
              w-full
              min-w-0
              overflow-auto
              border
              border-gray-300
              bg-white
              shadow-xl
            "
          >
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  onChange(item.id);

                  setQuery(item.name);

                  setItems([]);
                }}
                className="
                  block
                  min-h-10
                  w-full
                  border-b
                  border-gray-100
                  px-3
                  py-2
                  text-left
                  text-[12px]
                  font-medium
                  text-gray-900
                  transition
                  last:border-b-0
                  hover:bg-green-50
                "
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </Filter>
  );
}

/* =========================================================
 * SALE DETAIL
 * ========================================================= */

function SaleDetail({
  sale,
  onClose,
  language,
  t,
  setError,
  onChanged,
  canManageCommercial,
  initialAction,
}) {
  const [action, setAction] = useState(null);

  const [amount, setAmount] = useState("");

  const [method, setMethod] = useState("CASH");

  const [quantities, setQuantities] = useState({});
  const [returnDetail, setReturnDetail] = useState(null);

  useEffect(() => {
    if (!sale) return;

    setAction(initialAction || null);
    setAmount(
      String(sale.payment_summary?.balance_due ?? sale.balance_due ?? ""),
    );

    setQuantities(
      Object.fromEntries(
        sale.lines.map((line) => [
          line.id,
          line.remaining_delivery_quantity || 0,
        ]),
      ),
    );
  }, [sale, initialAction]);

  async function refresh(fn, closeAfterSuccess = false) {
    try {
      await fn();

      setAction(null);

      await onChanged?.();
      if (closeAfterSuccess) onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Modal
      open={Boolean(sale)}
      title={
        sale
          ? `${getDocumentTypeLabel(
              sale.fulfillment_type,
            )} ${sale.document_number}`
          : ""
      }
      onClose={onClose}
      width="xl"
      footer={
        <>
          {canManageCommercial &&
          (sale?.balance_due > 0 || sale?.payment_summary?.balance_due > 0) ? (
            <Button
              onClick={() => {
                setAmount(
                  String(
                    sale.payment_summary?.balance_due ?? sale.balance_due ?? "",
                  ),
                );
                setAction("payment");
              }}
            >
              {t("addPayment")}
            </Button>
          ) : null}

          {canManageCommercial &&
            sale?.deliveries?.[0]?.status === "PREPARED" && (
              <Button onClick={() => setAction("ship-confirm")}>
                {t("markAsShipped")}
              </Button>
            )}
          {canManageCommercial &&
            sale?.deliveries?.[0]?.status === "SHIPPED" && (
              <Button
                onClick={() =>
                  refresh(() => deliverDelivery(sale.deliveries[0].id))
                }
              >
                {t("markAsDelivered")}
              </Button>
            )}

          <Button variant="primary" onClick={onClose}>
            {t("close")}
          </Button>
        </>
      }
    >
      {sale && (
        <div className="p-5 text-[12px] text-gray-900">
          {/* =============================================
           * GENERAL INFORMATION
           * ============================================= */}

          <SectionTitle>{t("Informations")}</SectionTitle>

          <div className="grid grid-cols-1 gap-x-8 gap-y-3 border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info
              label={t("dateTime")}
              value={formatSaleDateTime(sale, language)}
            />

            <Info
              label={t("customer")}
              value={sale.customer_name || t("noCustomer")}
            />

            <Info label={t("seller")} value={sale.seller_name || "-"} />

            <Info
              label={t("cashRegister")}
              value={sale.cash_register_name || "-"}
            />

            <Info label={t("warehouse")} value={sale.warehouse_name || "-"} />

            <Info
              label={t("customerReference")}
              value={sale.customer_reference || "-"}
            />
          </div>

          {/* =============================================
           * STATUS
           * ============================================= */}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard
              label={t("Paiement")}
              value={sale.payment_status}
              detail={
                sale.payment_summary?.balance_due > 0
                  ? `Reste ${formatMoney(
                      sale.payment_summary?.balance_due || 0,
                      language,
                    )}`
                  : null
              }
            />

            {sale.fulfillment_type === "SHIPPING" ? (
              <StatusCard
                label={t("delivery")}
                value={sale.delivery_summary?.status}
              />
            ) : (
              <StatusCard
                label={t("Document")}
                customValue={getDocumentTypeLabel(sale.fulfillment_type)}
              />
            )}

            <StatusCard label={t("back")} value={sale.return_status} />
            <StatusCard
              label={t("invoicingSettings")}
              customValue={
                sale.invoice
                  ? `Facturé · ${sale.invoice.invoice_number}`
                  : "Non facturé"
              }
            />
          </div>

          {/* =============================================
           * ITEMS
           * ============================================= */}

          <SectionTitle className="mt-5">{t("items")}</SectionTitle>

          <div className="overflow-x-auto border border-gray-200">
            <table className="min-w-[800px] w-full border-collapse">
              <thead>
                <tr className="h-10 border-b border-gray-300 bg-gray-100">
                  <Th>{t("designation")}</Th>

                  <Th>{t("quantity")}</Th>

                  <Th>{t("unit")}</Th>

                  <Th right>{t("unitPriceHT")}</Th>

                  <Th right>{t("discount")}</Th>

                  <Th right>{t("total")}</Th>
                </tr>
              </thead>

              <tbody>
                {sale.lines.map((line) => (
                  <tr
                    key={line.id}
                    className="h-11 border-b border-gray-200 last:border-b-0"
                  >
                    <Td bold>{line.designation}</Td>

                    <Td>{formatQuantity(line.quantity, language)}</Td>

                    <Td>{line.unit_name}</Td>

                    <Td right>{formatMoney(line.unit_price, language)}</Td>

                    <Td right>{formatMoney(line.discount_amount, language)}</Td>

                    <Td right bold>
                      {formatMoney(line.total, language)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* =============================================
           * TOTALS
           * ============================================= */}

          <div className="ms-auto mt-4 w-full max-w-[330px] border border-gray-200 bg-gray-50 p-4">
            <Summary
              label={t("subtotal")}
              value={sale.subtotal}
              language={language}
            />

            <Summary
              label={t("discount")}
              value={
                Number(sale.line_discount_total || 0) +
                Number(sale.global_discount_amount || 0)
              }
              language={language}
            />

            <Summary
              label={t("total")}
              value={sale.total}
              language={language}
              strong
            />
            {sale.return_summary?.return_total > 0 && (
              <>
                <Summary
                  label={t("returns")}
                  value={-sale.return_summary.return_total}
                  language={language}
                />
                <Summary
                  label={t("Net après retours")}
                  value={sale.return_summary.net_sales_amount}
                  language={language}
                  strong
                />
              </>
            )}
          </div>

          {/* =============================================
           * PAYMENTS
           * ============================================= */}

          <SectionTitle className="mt-6">{t("payments")}</SectionTitle>

          <div className="border border-gray-200">
            {sale.payments?.length ? (
              sale.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 last:border-b-0"
                >
                  <span className="font-medium text-gray-800">
                    {payment.payment_method_name}

                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </span>

                  <b className="whitespace-nowrap font-bold text-gray-950">
                    {formatMoney(payment.amount, language)}
                  </b>
                </div>
              ))
            ) : (
              <div className="px-4 py-4 text-center font-medium text-gray-500">
                {t("Aucun paiement")}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border border-gray-300 bg-gray-50 px-4 py-3 text-[13px]">
            <span className="font-semibold text-gray-700">
              {t("totalPaid")}
            </span>

            <b className="text-[14px] font-bold text-gray-950">
              {formatMoney(
                sale.payments.reduce(
                  (sum, payment) => sum + Number(payment.amount || 0),
                  0,
                ),
                language,
              )}
            </b>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Summary
              label={t("paid")}
              value={sale.payment_summary?.paid_total || 0}
              language={language}
            />
            <Summary
              label={t("remaining")}
              value={sale.payment_summary?.balance_due || 0}
              language={language}
            />
            <div className="flex items-center justify-between border border-gray-300 bg-gray-50 px-4 py-3 text-[13px]">
              <span>{t("status")}</span>
              <Badge
                value={
                  sale.payment_summary?.payment_status || sale.payment_status
                }
              />
            </div>
          </div>
          {sale.payment_summary?.credit_used > 0 && (
            <div className="mt-2 flex justify-between border border-green-200 bg-green-50 px-4 py-3 text-[13px]">
              <span>{t("Solde client utilisé")}</span>
              <span>
                {formatMoney(sale.payment_summary.credit_used, language)}
              </span>
            </div>
          )}
          {sale.customer_credit_amount > 0 && (
            <div className="mt-2 flex justify-between border border-amber-200 bg-amber-50 px-4 py-3 text-[13px]">
              <span>{t("Crédit client (non encaissé)")}</span>
              <span>{formatMoney(sale.customer_credit_amount, language)}</span>
            </div>
          )}

          {/* =============================================
           * DELIVERY
           * ============================================= */}

          {sale.fulfillment_type === "SHIPPING" && (
            <section className="mt-6">
              <SectionTitle>{t("delivery")}</SectionTitle>

              <div className="border border-gray-200">
                {sale.lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 last:border-b-0"
                  >
                    <span className="font-semibold text-gray-900">
                      {line.designation}
                    </span>

                    <span className="text-[11px] font-medium text-gray-600">
                      {t("ORDERED")} {line.quantity} {t("· Livré")} {line.delivered_quantity}{" "}
                      {t("· Restant")} {line.remaining_delivery_quantity}
                    </span>
                  </div>
                ))}
              </div>

              {sale.deliveries?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {sale.deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between border border-green-200 bg-green-50 px-3 py-2"
                    >
                      <span className="font-semibold text-green-800">
                        {sale.sale_number} {t("· Livraison #")}{delivery.id}
                      </span>

                      <Badge value={delivery.status} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* =============================================
           * RETURNS
           * ============================================= */}

          {sale.returns.length > 0 && (
            <section className="mt-6">
              <SectionTitle>{t("returns")}</SectionTitle>

              <div className="border border-gray-200">
                {sale.returns.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 last:border-b-0"
                  >
                    <div>
                      <b className="block text-gray-950">
                        {item.return_number}
                      </b>
                      <span className="text-[10px] text-gray-500">
                        {formatSaleDateTime(
                          { ...item, sale_date: item.return_date },
                          language,
                        )}
                      </span>
                    </div>
                    <b>{formatMoney(item.return_total, language)}</b>
                    <Button
                      onClick={async () => {
                        try {
                          setReturnDetail(await getSaleReturn(item.id));
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      {t("Voir")}
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between bg-gray-50 px-4 py-3 font-bold">
                  <span>{t("Total retourné")}</span>
                  <span>
                    {formatMoney(
                      sale.return_summary?.return_total || 0,
                      language,
                    )}
                  </span>
                </div>
              </div>
            </section>
          )}

          <Modal
            open={!!returnDetail}
            title={returnDetail?.return_number || t("Détail du retour")}
            onClose={() => setReturnDetail(null)}
            width="lg"
            footer={
              <>
                <Button
                  onClick={() =>
                    window.electronAPI?.printDocument?.(
                      returnDetail,
                      returnDetail?.print_profile,
                    )
                  }
                >
                  {t("reprint")}
                </Button>
                <Button variant="primary" onClick={() => setReturnDetail(null)}>
                  {t("close")}
                </Button>
              </>
            }
          >
            {returnDetail && (
              <div className="p-5 text-[12px]">
                <div className="mb-4 grid grid-cols-2 gap-3 bg-gray-50 p-4">
                  <Info
                    label={t("Vente originale")}
                    value={returnDetail.sale_number}
                  />
                  <Info
                    label={t("dateTime")}
                    value={formatSaleDateTime(returnDetail, language)}
                  />
                  <Info
                    label={t("user")}
                    value={returnDetail.validated_by_name || "-"}
                  />
                  <Info
                    label={t("Montant retourné")}
                    value={formatMoney(returnDetail.return_total, language)}
                  />
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="h-10 border-b bg-gray-100">
                      <Th>{t("Article")}</Th>
                      <Th>{t("Qté retournée")}</Th>
                      <Th>{t("Prix historique")}</Th>
                      <Th>{t("Montant")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnDetail.lines.map((line) => (
                      <tr key={line.id} className="h-11 border-b">
                        <Td bold>{line.designation}</Td>
                        <Td>{line.quantity}</Td>
                        <Td>
                          {formatMoney(
                            line.historical_unit_total || line.unit_price,
                            language,
                          )}
                        </Td>
                        <Td bold>{formatMoney(line.total, language)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex justify-between border-t-2 border-black pt-3 text-[14px] font-bold">
                  <span>{t("Montant retourné")}</span>
                  <span>
                    {formatMoney(returnDetail.return_total, language)}
                  </span>
                </div>
              </div>
            )}
          </Modal>

          {/* =============================================
           * SECONDARY ACTION MODAL
           * ============================================= */}

          <Modal
            open={Boolean(action)}
            title={
              action === "ship-confirm"
                ? t("Confirmer l’expédition")
                : t("Ajouter un paiement")
            }
            onClose={() => setAction(null)}
            width="md"
            footer={
              <>
                <Button onClick={() => setAction(null)}>{t("cancel")}</Button>

                <Button
                  variant="primary"
                  onClick={() =>
                    action === "ship-confirm"
                      ? refresh(() => validateDelivery(sale.deliveries[0].id))
                      : refresh(
                          () =>
                            addSalePayment(sale.id, {
                              amount: Number(amount),
                              payment_method_code: method,
                            }),
                          true,
                        )
                  }
                >
                  {action === "ship-confirm" ? "Expédier" : "Valider"}
                </Button>
              </>
            }
          >
            <div className="space-y-4 p-5">
              {action === "ship-confirm" ? (
                <p className="text-[13px]">
                  {t("Confirmer l’expédition ? Le stock correspondant sera sorti.")}
                </p>
              ) : action === "payment" ? (
                <>
                  <Filter label={t("Montant")}>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={t("Montant")}
                      className={controlClassName}
                    />
                  </Filter>

                  <Filter label={t("Moyen de paiement")}>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className={controlClassName}
                    >
                      <option value="CASH">{t("Espèces")}</option>

                      <option value="CARD">{t("Carte")}</option>

                      <option value="BANK_TRANSFER">{t("Virement")}</option>

                      <option value="CHEQUE">{t("Chèque")}</option>
                    </select>
                  </Filter>
                </>
              ) : (
                sale.lines.map((line) => (
                  <label
                    key={line.id}
                    className="grid grid-cols-[minmax(0,1fr)_100px] items-center gap-3 border-b border-gray-200 pb-3 last:border-b-0"
                  >
                    <span className="min-w-0 font-semibold text-gray-900">
                      <span className="block truncate">{line.designation}</span>

                      <small className="mt-1 block text-[10px] font-medium text-gray-500">
                        {t("Disponible :")}{" "}
                        {action === "delivery"
                          ? line.remaining_delivery_quantity
                          : line.invoiceable_quantity}
                      </small>
                    </span>

                    <input
                      type="number"
                      min="0"
                      value={quantities[line.id] ?? 0}
                      onChange={(e) =>
                        setQuantities((current) => ({
                          ...current,

                          [line.id]: e.target.value,
                        }))
                      }
                      className="h-9 w-full border border-gray-400 bg-white px-2 text-[12px] font-semibold text-gray-950 outline-none focus:border-gray-700"
                    />
                  </label>
                ))
              )}
            </div>
          </Modal>
        </div>
      )}
    </Modal>
  );
}

/* =========================================================
 * STATUS SYSTEM
 *
 * IMPORTANT:
 * This map should become the visual reference for all other
 * business lists: purchases, receipts, orders, returns, etc.
 * ========================================================= */

const statusConfig = {
  /* Payment */

  UNPAID: {
    label: "Non payé",
    className: "border-red-200 bg-red-50 text-red-800",
  },

  PARTIALLY_PAID: {
    label: "Partiel",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },

  PAID: {
    label: "Payé",
    className: "border-green-200 bg-green-50 text-green-800",
  },

  /* Delivery */

  NOT_REQUIRED: {
    label: "—",
    className: "border-gray-200 bg-gray-50 text-gray-500",
  },

  PENDING: {
    label: "À livrer",
    className: "border-orange-200 bg-orange-50 text-orange-800",
  },

  PREPARED: {
    label: "Préparée",
    className: "border-orange-200 bg-orange-50 text-orange-800",
  },
  SHIPPED: {
    label: "Expédiée",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },

  PARTIALLY_DELIVERED: {
    label: "Livraison partielle",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },

  DELIVERED: {
    label: "Livré",
    className: "border-green-200 bg-green-50 text-green-800",
  },

  /* Invoicing */

  NOT_INVOICED: {
    label: "Non facturé",
    className: "border-gray-300 bg-gray-100 text-gray-700",
  },

  PARTIALLY_INVOICED: {
    label: "Facturation partielle",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },

  INVOICED: {
    label: "Facturé",
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
  },

  /* General state */

  COMPLETED: {
    label: "Terminée",
    className: "border-green-200 bg-green-50 text-green-800",
  },

  CANCELLED: {
    label: "Annulée",
    className: "border-red-200 bg-red-50 text-red-800",
  },

  DRAFT: {
    label: "Brouillon",
    className: "border-gray-300 bg-gray-100 text-gray-700",
  },

  VALIDATED: {
    label: "Validée",
    className: "border-green-200 bg-green-50 text-green-800",
  },

  /* Returns */

  NOT_RETURNED: {
    label: "Aucun retour",
    className: "border-gray-200 bg-gray-50 text-gray-600",
  },

  PARTIALLY_RETURNED: {
    label: "Retour partiel",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },

  RETURNED: {
    label: "Retournée",
    className: "border-purple-200 bg-purple-50 text-purple-800",
  },

  FULLY_RETURNED: {
    label: "Retournée",
    className: "border-purple-200 bg-purple-50 text-purple-800",
  },
};

/* =========================================================
 * BADGE
 * ========================================================= */

const Badge = ({ value }) => {
  return value ? <BusinessStatusBadge value={value} /> : <MutedDash />;
};

/* =========================================================
 * STATUS CARD
 * ========================================================= */

function StatusCard({ label, value, customValue, detail }) {
  return (
    <div className="border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        {label}
      </div>

      {value ? (
        <Badge value={value} />
      ) : (
        <span className="text-[12px] font-bold text-gray-900">
          {customValue || "-"}
        </span>
      )}

      {detail && (
        <div className="mt-2 text-[11px] font-medium text-gray-600">
          {detail}
        </div>
      )}
    </div>
  );
}

/* =========================================================
 * DOCUMENT TYPE
 * ========================================================= */

function getDocumentTypeLabel(value) {
  if (value === "SHIPPING") {
    return "Livraison";
  }
  if (value === "IMMEDIATE") {
    return "Vente comptoir";
  }
  return "Vente";
}

function DocumentTypeLabel({ value }) {
  const label = getDocumentTypeLabel(value);

  const styles = {
    IMMEDIATE: "border-gray-300 bg-gray-100 text-gray-800",
    SHIPPING: "border-teal-200 bg-teal-50 text-teal-800",
  };

  return (
    <span
      className={`
        inline-flex
        h-[26px]
        items-center
        whitespace-nowrap
        border
        px-2
        text-[11px]
        font-semibold
        ${styles[value] || "border-gray-300 bg-gray-50 text-gray-700"}
      `}
    >
      {label}
    </span>
  );
}

/* =========================================================
 * SHARED FORM CONTROL STYLE
 * ========================================================= */

const controlClassName = `
  h-[42px]
  w-full
  min-w-0
  border
  border-gray-400
  bg-white
  px-3
  text-[12px]
  font-medium
  text-gray-950
  outline-none
  transition
  placeholder:text-gray-500
  focus:border-gray-700
  focus:ring-1
  focus:ring-gray-300
`;

/* =========================================================
 * FILTER WRAPPER
 * ========================================================= */

const Filter = ({ label, children, hiddenLabel, className = "" }) => (
  <label className={`block min-w-0 ${className}`}>
    <span
      className={`
        mb-1.5
        block
        min-h-[15px]
        text-[10px]
        font-bold
        uppercase
        tracking-wide
        text-gray-600
        ${hiddenLabel ? "invisible" : ""}
      `}
    >
      {label}
    </span>

    {children}
  </label>
);

/* =========================================================
 * DATE INPUT
 * ========================================================= */

function LocalizedDateInput({ value, onChange, t }) {
  const displayValue = value ? value.split("-").reverse().join("/") : "";

  const [display, setDisplay] = useState(displayValue);

  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDisplay(displayValue);
    setInvalid(false);
  }, [value]);

  function change(next) {
    const digits = next.replace(/\D/g, "").slice(0, 8);

    const cleaned = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
      .filter(Boolean)
      .join("/");

    setDisplay(cleaned);

    if (!cleaned) {
      setInvalid(false);
      onChange("");
      return;
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
      return;
    }

    const [day, month, year] = cleaned.split("/");

    const normalized = `${year}-${month}-${day}`;

    const date = new Date(`${normalized}T00:00:00`);

    const valid =
      date.getFullYear() === Number(year) &&
      date.getMonth() + 1 === Number(month) &&
      date.getDate() === Number(day);

    setInvalid(!valid);

    if (valid) {
      onChange(normalized);
    }
  }

  return (
    <input
      inputMode="numeric"
      value={display}
      onChange={(event) => change(event.target.value)}
      onBlur={() =>
        setInvalid(Boolean(display) && !/^\d{2}\/\d{2}\/\d{4}$/.test(display))
      }
      placeholder={t("datePlaceholder")}
      title={invalid ? t("invalidDate") : undefined}
      aria-invalid={invalid}
      className={`
        ${controlClassName}
        ${invalid ? "!border-red-500 !bg-red-50" : ""}
      `}
    />
  );
}

/* =========================================================
 * TABLE HELPERS
 * ========================================================= */

/* =========================================================
 * EMPTY STATE
 * ========================================================= */

const Empty = ({ children, colSpan }) => (
  <tr>
    <td
      colSpan={colSpan}
      className="h-40 text-center text-[13px] font-medium text-gray-500"
    >
      {children}
    </td>
  </tr>
);

/* =========================================================
 * INFO
 * ========================================================= */

const Info = ({ label, value }) => (
  <div className="min-w-0">
    <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
      {label}
    </span>

    <span className="mt-1 block truncate text-[12px] font-semibold text-gray-950">
      {value ?? "-"}
    </span>
  </div>
);

/* =========================================================
 * SUMMARY
 * ========================================================= */

const Summary = ({ label, value, language, strong }) => (
  <div
    className={`
      flex
      items-center
      justify-between
      gap-4
      py-1.5
      ${strong ? "mt-2 border-t border-gray-300 pt-3" : ""}
    `}
  >
    <span
      className={
        strong
          ? "text-[14px] font-bold text-gray-950"
          : "text-[12px] font-medium text-gray-700"
      }
    >
      {label}
    </span>

    <b
      className={
        strong
          ? "text-[16px] font-bold text-gray-950"
          : "text-[12px] font-bold text-gray-900"
      }
    >
      {formatMoney(value, language)}
    </b>
  </div>
);

/* =========================================================
 * SECTION TITLE
 * ========================================================= */

const SectionTitle = ({ children, className = "" }) => (
  <h3
    className={`
      mb-2
      text-[11px]
      font-bold
      uppercase
      tracking-wide
      text-gray-700
      ${className}
    `}
  >
    {children}
  </h3>
);

/* =========================================================
 * MUTED DASH
 * ========================================================= */

const MutedDash = () => <span className="font-medium text-gray-400">—</span>;

/* =========================================================
 * DATE / TIME FORMATTER
 * ========================================================= */

function formatSaleDateTime(sale, language) {
  const timestamp = sale.completed_at || sale.created_at;

  if (!timestamp) {
    return formatDate(sale.sale_date, language);
  }

  const normalized = /[zZ]|[+-]\d\d:\d\d$/.test(timestamp)
    ? timestamp
    : `${timestamp.replace(" ", "T")}Z`;

  const time = new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(normalized));

  return `${formatDate(sale.sale_date, language)} ${time}`;
}
