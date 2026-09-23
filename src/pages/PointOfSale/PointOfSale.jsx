import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  ChevronDown,
  MoreHorizontal,
  Search,
  UserRound,
} from "lucide-react";
import Button from "../../components/ui/Button";
import ErrorMessage from "../../components/ui/ErrorMessage";
import Modal from "../../components/ui/Modal";
import { inputClass } from "../../components/ui/FormField";
import { formatDateTime, formatMoney } from "../../utils/formatters";
import {
  finalizeSale,
  addPosProductSerial,
  getPosContext,
  getPosProductUnits,
  getPosProductSerials,
  getPosSale,
  getSuspendedSales,
  searchPosCustomers,
  searchPosProducts,
  suspendSale,
  updatePosSale,
} from "../../api/pos.model";
import { useLanguage } from "../../i18n/LanguageContext";
import CartTable from "./CartTable";
import { profileTypeForDocument } from "../../utils/salePrintTemplate";
import {
  ArticleEditor,
  CashMovementDialog,
  DiscountDialog,
  MiscDialog,
  PaymentDialog,
  SerialSelectionDialog,
  BatchSelectionDialog,
} from "./PosDialogs";
import { createCashMovement } from "../../api/cash-session.model";
import { getStockBatches } from "../../api/inventory.model";
import {
  createSaleReturn,
  saveQuote,
  updateQuote,
} from "../../api/commercial.model";
const key = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const DialogField = ({ label, children }) => (
  <label className="block text-[11px] font-semibold">
    <span className="mb-1 block">{label}</span>
    {children}
  </label>
);

function CompactFrenchDateInput({ value, onChange, disabled }) {
  const { t } = useLanguage();
  const formatValue = (isoValue) =>
    isoValue ? isoValue.split("-").reverse().join("/") : "";
  const [displayValue, setDisplayValue] = useState(() => formatValue(value));

  useEffect(() => setDisplayValue(formatValue(value)), [value]);

  const updateDate = (rawValue) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 8);
    const formatted = [
      digits.slice(0, 2),
      digits.slice(2, 4),
      digits.slice(4, 8),
    ]
      .filter(Boolean)
      .join("/");
    setDisplayValue(formatted);
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) return;
    const [day, month, year] = formatted.split("/");
    const isoValue = `${year}-${month}-${day}`;
    const parsed = new Date(`${isoValue}T00:00:00`);
    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() + 1 === Number(month) &&
      parsed.getDate() === Number(day) &&
      isoValue <= new Date().toISOString().slice(0, 10)
    )
      onChange(isoValue);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      disabled={disabled}
      onChange={(event) => updateDate(event.target.value)}
      onBlur={() => setDisplayValue(formatValue(value))}
      placeholder={t("datePlaceholder")}
      aria-label={t("saleDate")}
      className={inputClass}
    />
  );
}

export default function PointOfSale({
  session,
  warehouseId,
  cashSession,
  onNavigate,
  onSaleFinalized,
  initialQuote,
  initialQuoteEdit = false,
  initialMode = "SALE",
  initialDocumentType,
  initialReturnSale,
  initialEditSale,
}) {
  const { language, t } = useLanguage(),
    searchRef = useRef(null);
  const [context, setContext] = useState(null),
    [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [highlight, setHighlight] = useState(-1),
    [lines, setLines] = useState([]),
    [selected, setSelected] = useState(0),
    [customer, setCustomer] = useState(null),
    [fulfillmentType, setFulfillmentType] = useState("IMMEDIATE"),
    [deliveryStatus, setDeliveryStatus] = useState("PREPARED"),
    [documentType, setDocumentType] = useState("TICKET"),
    [printFormat, setPrintFormat] = useState("THERMAL_80"),
    [globalDiscount, setGlobalDiscount] = useState({
      type: "PERCENT",
      value: 0,
    }),
    [saleDate, setSaleDate] = useState(() =>
      new Date().toISOString().slice(0, 10),
    ),
    [note, setNote] = useState(""),
    [customerReference, setCustomerReference] = useState(""),
    [validUntil, setValidUntil] = useState(""),
    [billingChoice, setBillingChoice] = useState("NOT_INVOICED"),
    [articleUnits, setArticleUnits] = useState([]),
    [dialog, setDialog] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [feedback, setFeedback] = useState(null),
    [lastSale, setLastSale] = useState(null),
    [suspendedId, setSuspendedId] = useState(null),
    [requestId, setRequestId] = useState(key);
  const [serialPicker, setSerialPicker] = useState({
    product: null,
    serials: [],
    loading: false,
    saving: false,
    error: "",
  });
  const [batchPicker, setBatchPicker] = useState({
    product: null,
    batches: [],
    loading: false,
    error: "",
  });
  const [mode, setMode] = useState("SALE"),
    [sourceQuoteId, setSourceQuoteId] = useState(null),
    [sourceSaleId, setSourceSaleId] = useState(null),
    [returnSettlementMode, setReturnSettlementMode] = useState("CUSTOMER_CREDIT"),
    [refundPaymentMethodCode, setRefundPaymentMethodCode] = useState("CASH");
  const requiresDelivery = mode === "SALE" && fulfillmentType === "SHIPPING";
  const editingSale = !!initialEditSale;
  const saleLinesLocked = !!initialEditSale?.deliveries?.some((delivery) =>
    ["SHIPPED", "DELIVERED"].includes(delivery.status),
  );
  const documentLabel =
    mode === "QUOTE"
      ? "Facture proforma"
      : mode === "RETURN"
        ? "Bon de retour"
        : documentType === "TICKET"
          ? "Ticket"
          : documentType === "DELIVERY_NOTE"
            ? "Bon de livraison"
            : "Bon pour";
  const settings = context?.settings?.sales || {};
  useEffect(() => {
    getPosContext(warehouseId)
      .then((data) => {
        setContext(data);
        if (!initialEditSale) {
          setCustomer(data.default_customer);
          setFulfillmentType(
            data.settings.sales.default_fulfillment_type || "IMMEDIATE",
          );
        }
        setDocumentType(data.settings.sales.default_print_document || "TICKET");
        setPrintFormat(
          data.settings.sales.default_print_format || "THERMAL_80",
        );
        setTimeout(() => searchRef.current?.focus(), 0);
      })
      .catch((e) => setError(e.message));
  }, [warehouseId, initialEditSale]);
  useEffect(() => {
    if (!context) return;
    if (context.settings.sales.default_print_format === "NONE") {
      setPrintFormat("NONE");
      return;
    }
    const type =
        mode === "QUOTE"
          ? "QUOTE"
          : mode === "RETURN"
            ? "SALES_RETURN"
            : profileTypeForDocument(documentType),
      profile = context.print_profiles.find(
        (item) => item.document_type === type,
      );
    if (profile) {
      setPrintFormat(
        profile.paper_format || context.settings.sales.default_print_format,
      );
    }
  }, [context, mode, documentType]);
  useEffect(() => {
    if (!initialQuote) return;
    setMode(initialQuoteEdit ? "QUOTE" : "SALE");
    setSourceQuoteId(initialQuoteEdit ? null : initialQuote.id);
    setFulfillmentType(
      initialDocumentType === "DELIVERY_NOTE" ? "SHIPPING" : "IMMEDIATE",
    );
    setDocumentType(initialDocumentType === "SALES_INVOICE" ? "BON_POUR" : initialDocumentType || "BON_POUR");
    setCustomer({
      id: initialQuote.customer_id,
      name: initialQuote.customer_name,
    });
    setLines(
      (initialQuote.lines || []).map((line) => ({ ...line, key: key() })),
    );
    setGlobalDiscount({
      type: initialQuote.global_discount_type || "PERCENT",
      value: initialQuote.global_discount_value || 0,
    });
    setNote(initialQuote.note || "");
    setCustomerReference(initialQuote.customer_reference || "");
    setValidUntil(initialQuote.valid_until || "");
  }, [initialQuote, initialDocumentType, initialQuoteEdit]);
  useEffect(() => {
    if (!initialQuote) setMode(initialMode);
  }, [initialMode, initialQuote]);
  useEffect(() => {
    if (!initialReturnSale) return;
    const historicalLinesTotal = (initialReturnSale.lines || []).reduce(
      (sum, line) => sum + Number(line.total || 0),
      0,
    );
    const returnFactor =
      historicalLinesTotal > 0
        ? Number(initialReturnSale.total) / historicalLinesTotal
        : 1;
      setMode("RETURN");
      setSourceSaleId(initialReturnSale.id);
      setReturnSettlementMode("CUSTOMER_CREDIT");
    setCustomer(
      initialReturnSale.customer_id
        ? {
            id: initialReturnSale.customer_id,
            name: initialReturnSale.customer_name,
          }
        : null,
    );
    setLines(
      (initialReturnSale.lines || [])
        .filter((line) => Number(line.returnable_quantity) > 0)
        .map((line) => ({
          ...line,
          sale_line_id: line.id,
          sold_quantity: line.quantity,
          quantity: 0,
          return_unit_total:
            (Number(line.total) / Number(line.quantity)) * returnFactor,
          key: key(),
        })),
    );
    setNote("");
    setCustomerReference(initialReturnSale.sale_number || "");
  }, [initialReturnSale]);
  useEffect(() => {
    if (!initialEditSale) return;
    setMode("SALE");
    setCustomer(
      initialEditSale.customer_id
        ? {
            id: initialEditSale.customer_id,
            name: initialEditSale.customer_name,
          }
        : null,
    );
    setFulfillmentType(initialEditSale.fulfillment_type);
    setDeliveryStatus(
      initialEditSale.deliveries?.at(-1)?.status || "PREPARED",
    );
    setLines(
      (initialEditSale.lines || []).map((line) => ({ ...line, key: key() })),
    );
    setGlobalDiscount({
      type: initialEditSale.global_discount_type || "PERCENT",
      value:
        initialEditSale.global_discount_value ??
        initialEditSale.global_discount_percent ??
        0,
    });
    setSaleDate(initialEditSale.sale_date);
    setNote(initialEditSale.note || "");
    setCustomerReference(initialEditSale.customer_reference || "");
    setBillingChoice(initialEditSale.invoice ? "INVOICE" : "NOT_INVOICED");
    setRequestId(key());
    if (
      initialEditSale.deliveries?.some((delivery) =>
        ["SHIPPED", "DELIVERED"].includes(delivery.status),
      )
    )
      setError(
        t("Cette vente a déjà été expédiée. Les articles et quantités ne peuvent plus être modifiés."),
      );
  }, [initialEditSale, t]);
  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(
      () => setFeedback(null),
      feedback.change ? 5000 : 2000,
    );
    return () => clearTimeout(timer);
  }, [feedback]);
  const preview = useMemo(
    () =>
      lines.map((line) => {
        const sub = Number(line.quantity) * Number(line.unit_price),
          discountAmount =
            line.discount_type === "FIXED"
              ? Number(line.discount_value || 0)
              : (sub *
                  Number(line.discount_value ?? line.discount_percent ?? 0)) /
                100,
          net = Math.max(0, sub - discountAmount);
        return { ...line, preview_total: Math.round(net * 100) / 100 };
      }),
    [lines],
  );
  const summary = useMemo(() => {
    const subtotal = preview.reduce(
        (s, l) => s + Number(l.quantity) * Number(l.unit_price),
        0,
      ),
      lineDiscount = preview.reduce(
        (s, l) =>
          s +
          (l.discount_type === "FIXED"
            ? Number(l.discount_value || 0)
            : (Number(l.quantity) *
                Number(l.unit_price) *
                Number(l.discount_value ?? l.discount_percent ?? 0)) /
              100),
        0,
      ),
      netBeforeGlobal = subtotal - lineDiscount,
      globalAmount =
        globalDiscount.type === "FIXED"
          ? Number(globalDiscount.value || 0)
          : (netBeforeGlobal * Number(globalDiscount.value || 0)) / 100,
      total = Math.round((netBeforeGlobal - globalAmount) * 100) / 100;
    return {
      subtotal,
      lineDiscount,
      globalAmount,
      total,
    };
  }, [preview, globalDiscount]);
  const editImpact = useMemo(() => {
    if (!initialEditSale) return { changed: 0, stock: [] };
    const originals = new Map(
      (initialEditSale.lines || []).map((line) => [Number(line.id), line]),
    );
    let changed = 0;
    for (const line of lines) {
      const old = originals.get(Number(line.id));
      if (
        !old ||
        Number(old.product_unit_id) !== Number(line.product_unit_id) ||
        Math.abs(Number(old.quantity) - Number(line.quantity)) > 1e-9 ||
        Math.abs(Number(old.unit_price) - Number(line.unit_price)) > 0.001
      )
        changed += 1;
      if (old) originals.delete(Number(line.id));
    }
    changed += originals.size;
    const stock = new Map();
    for (const line of initialEditSale.lines || [])
      if (line.product_id && line.base_quantity != null)
        stock.set(Number(line.product_id), {
          designation: line.designation,
          delta: -Number(line.base_quantity),
        });
    for (const line of lines)
      if (line.product_id && line.conversion_factor != null) {
        const current = stock.get(Number(line.product_id)) || {
          designation: line.designation,
          delta: 0,
        };
        current.delta +=
          Number(line.quantity) * Number(line.conversion_factor || 1);
        stock.set(Number(line.product_id), current);
      }
    return {
      changed,
      stock: [...stock.values()].filter((item) => Math.abs(item.delta) > 1e-9),
    };
  }, [initialEditSale, lines]);
  function focusSearch() {
    setTimeout(() => searchRef.current?.focus(), 0);
  }
  function commitProduct(item, serial = null, batch = null) {
    if (saleLinesLocked) return;
    const line = {
      key: key(),
      line_type: "PRODUCT",
      product_id: item.product_id,
      product_unit_id: item.product_unit_id,
      designation: item.designation,
      reference: item.reference,
      barcode: item.barcode,
      unit_name: item.unit_name,
      conversion_factor: item.conversion_factor,
      quantity: 1,
      unit_price: item.selling_price,
      discount_percent: 0,
      discount_type: "PERCENT",
      discount_value: 0,
      stock_quantity: item.stock_quantity,
      track_stock: item.track_stock,
      min_stock: item.min_stock,
      nearest_expiration: item.nearest_expiration,
      track_serials: item.track_serials,
      serial_ids: serial ? [serial.id] : [],
      serial_numbers: serial ? [serial.serial_number] : [],
      batch_id: batch?.id || null,
      batch_number: batch?.batch_number || null,
    };
    if (settings.existing_product_behavior === "INCREMENT_QUANTITY" && !item.track_serials) {
      const index = lines.findIndex(
        (l) => l.product_unit_id === line.product_unit_id,
      );
      if (index >= 0) {
        setLines((rows) =>
          rows.map((l, i) =>
            i === index ? { ...l, quantity: Number(l.quantity) + 1 } : l,
          ),
        );
        setSelected(index);
      } else {
        setLines((rows) => [...rows, line]);
        setSelected(lines.length);
      }
    } else {
      setLines((rows) => [...rows, line]);
      setSelected(lines.length);
    }
    setQuery("");
    setResults([]);
    focusSearch();
  }
  async function addProduct(item) {
    if (saleLinesLocked) return;
    if (!item.track_serials || mode !== "SALE") {
      if (item.track_batches && mode === "SALE") {
        setQuery("");
        setResults([]);
        setBatchPicker({ product: item, batches: [], loading: true, error: "" });
        getStockBatches(warehouseId, item.product_id)
          .then((batches) =>
            setBatchPicker((current) => ({ ...current, batches, loading: false })),
          )
          .catch((error) =>
            setBatchPicker((current) => ({ ...current, loading: false, error: error.message })),
          );
        return;
      }
      commitProduct(item);
      return;
    }
    setQuery("");
    setResults([]);
    setSerialPicker({ product: item, serials: [], loading: true, saving: false, error: "" });
    try {
      const serials = await getPosProductSerials(item.product_id, warehouseId),
        alreadySelected = new Set(lines.flatMap((line) => line.serial_ids || []).map(Number));
      setSerialPicker((current) => ({
        ...current,
        serials: serials.filter((serial) => !alreadySelected.has(Number(serial.id))),
        loading: false,
      }));
    } catch (e) {
      setSerialPicker((current) => ({ ...current, loading: false, error: e.message }));
    }
  }
  function changeFulfillmentType(value) {
    setFulfillmentType(value);
    if (value === "IMMEDIATE" && documentType === "DELIVERY_NOTE") setDocumentType("TICKET");
    if (value === "SHIPPING" && documentType === "TICKET") setDocumentType("DELIVERY_NOTE");
  }
  function changeOperation(next) {
    const mustReset = mode === "QUOTE" && next === "SALE" && lines.length;
    setMode(next);
    setSourceQuoteId(null);
    setSourceSaleId(null);
    if (next === "SALE") setFulfillmentType(settings.default_fulfillment_type || "IMMEDIATE");
    if (next === "RETURN") {
      setLines([]);
      setError(t("Sélectionnez une vente depuis le module Ventes pour créer un retour."));
    }
    if (mustReset) {
      setLines([]);
      setSelected(0);
      setDialog({ type: "tracking-reset-warning" });
    }
  }
  async function doSearch(value) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    try {
      const found = await searchPosProducts(value, warehouseId);
      if (
        settings.scan_add_immediately &&
        found.length &&
        found[0].exact_match &&
        found.filter((x) => x.exact_match).length === 1
      )
        addProduct(found[0]);
      else {
        setResults(found);
        setHighlight(-1);
      }
    } catch (e) {
      setError(e.message);
    }
  }
  async function handleSearchEnter() {
    if (!query.trim()) return;
    const current = results[highlight] || results[0];
    if (current) {
      addProduct(current);
      return;
    }
    try {
      const found = await searchPosProducts(query.trim(), warehouseId);
      if (found[0]) addProduct(found[0]);
    } catch (e) {
      setError(e.message);
    }
  }
  function patchSelected(patch) {
    if (saleLinesLocked) return;
    setLines((rows) =>
      rows.map((line, i) => (i === selected ? { ...line, ...patch } : line)),
    );
    setDialog(null);
    focusSearch();
  }
  function remove(index) {
    if (saleLinesLocked) return;
    setLines((rows) => rows.filter((_, i) => i !== index));
    setSelected(Math.max(0, index - 1));
    focusSearch();
  }
  async function openArticle(focus = "quantity", index = selected) {
    if (saleLinesLocked) return;
    const line = lines[index];
    if (!line) return;
    setSelected(index);
    try {
      setArticleUnits(
        line.product_id ? await getPosProductUnits(line.product_id) : [],
      );
      setDialog({ type: "article", focus });
    } catch (e) {
      setError(e.message);
    }
  }
  async function changeUnit() {
    const line = lines[selected];
    if (!line?.product_id) return;
    try {
      const units = await getPosProductUnits(line.product_id);
      setDialog({ type: "units", units });
    } catch (e) {
      setError(e.message);
    }
  }
  function salePayload(extra = {}) {
    return {
      warehouse_id: Number(warehouseId),
      customer_id: customer?.id || null,
      fulfillment_type: fulfillmentType,
      delivery_status: fulfillmentType === "SHIPPING" ? deliveryStatus : null,
      sale_date: saleDate,
      note,
      customer_reference: customerReference,
      valid_until: mode === "QUOTE" ? validUntil || null : undefined,
      global_discount_type: globalDiscount.type,
      global_discount_value: globalDiscount.value,
      lines: lines.map(({ key: _, preview_total: __, ...line }) => line),
      ...extra,
      requires_delivery: requiresDelivery,
      source_quote_id: sourceQuoteId,
    };
  }
  async function recordQuote() {
    if (!lines.length) return;
    try {
      setSaving(true);
      setError("");
      const payload = {
          ...salePayload(),
          quote_date: saleDate,
          client_request_id: requestId,
        },
        quote =
          initialQuoteEdit && initialQuote
            ? await updateQuote(initialQuote.id, payload)
            : await saveQuote(payload),
        profile = context.print_profiles.find(
          (item) => item.document_type === "QUOTE",
        );
      setLastSale(quote);
      setFeedback({ saleNumber: quote.quote_number, change: 0 });
      newSale();
      if (printFormat !== "NONE") {
        try {
          await window.electronAPI?.printDocument?.(quote, {
            ...profile,
            paper_format: printFormat,
          });
        } catch (e) {
          setError(`${t("printFailed")}: ${e.message}`);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function recordReturn() {
    if (!sourceSaleId) {
      setError("Créez le retour depuis le détail d'une vente.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const result = await createSaleReturn(sourceSaleId, {
        client_request_id: requestId,
        return_date: saleDate,
        note,
        settlement_mode: returnSettlementMode,
        refund_payment_method_code: refundPaymentMethodCode,
        lines: lines.map((line) => ({
          sale_line_id: line.sale_line_id || line.id,
          quantity: Number(line.quantity),
        })),
      });
      setLastSale(result);
      setFeedback({ saleNumber: result.return_number, change: 0 });
      newSale();
      if (printFormat !== "NONE") {
        try {
          await window.electronAPI?.printDocument?.(result, { ...result.print_profile, paper_format: printFormat });
        } catch (e) {
          setError(`${t("printFailed")}: ${e.message}`);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function suspend() {
    if (!lines.length) return;
    try {
      setSaving(true);
      await suspendSale(salePayload());
      newSale();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function pay(payments, paymentOptions = {}) {
    if (saving) return;
    let sale;
    try {
      setSaving(true);
      setError("");
      const paid = payments.reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0,
        ),
        creditUsed = Number(paymentOptions.customer_credit_used || 0),
        leaveUnpaid = paid + creditUsed + 0.001 < summary.total;
      sale = await finalizeSale(
        salePayload({
          payments,
          ...paymentOptions,
          leave_unpaid: leaveUnpaid,
          client_request_id: requestId,
          suspended_sale_id: suspendedId,
          document_type: documentType,
          invoice_requested: billingChoice === "INVOICE",
        }),
      );
    } catch (e) {
      setError(e.message);
      setSaving(false);
      return;
    }
    const profile = context.print_profiles.find(
        (item) => item.document_type === profileTypeForDocument(documentType),
      ) || context.print_profiles.find((item) => item.document_type === "SALE"),
      change = sale.payments.reduce(
        (sum, payment) => sum + Number(payment.change_amount || 0),
        0,
      );
    setLastSale(sale);
    newSale();
    setFeedback({
      saleNumber: sale.document_number || sale.sale_number,
      change,
    });
    setSaving(false);
    try {
      await onSaleFinalized?.();
    } catch (e) {
      setError(e.message);
    }
    if (printFormat !== "NONE" && window.electronAPI?.printSale)
      try {
        await window.electronAPI.printSale(sale, {
          ...profile,
          document_type: documentType,
          paper_format: printFormat,
        });
      } catch (e) {
        setError(`${t("printFailed")}: ${e.message}`);
      }
  }
  async function saveSaleEdit() {
    try {
      setSaving(true);
      setError("");
      const sale = await updatePosSale(
        initialEditSale.id,
        salePayload({ client_request_id: requestId }),
      );
      setDialog(null);
      setFeedback({ saleNumber: sale.sale_number, change: 0 });
      await onSaleFinalized?.();
      onNavigate?.("sales");
    } catch (e) {
      setError(e.message);
      setDialog(null);
    } finally {
      setSaving(false);
    }
  }
  async function quickCheckout() {
    if (saving || !lines.length || !settings.quick_checkout_enabled) return;
    const configured =
        settings.quick_checkout_payment_method === "DEFAULT"
          ? context.settings.payments.default_method
          : settings.quick_checkout_payment_method,
      method = context.payment_methods.find((item) => item.code === configured);
    if (
      !method ||
      (method.code === "CUSTOMER_CREDIT" && !customer) ||
      (method.affects_cash_drawer &&
        context.settings.cash.require_open_session_for_cash_payment &&
        !context.cash_session)
    ) {
      setError(t("quickCheckoutUnavailable"));
      setDialog({ type: "payment" });
      return;
    }
    await pay([
      {
        code: method.code,
        amount: summary.total,
        amount_received: summary.total,
      },
    ]);
  }
  function newSale() {
    setLines([]);
    setCustomer(context?.default_customer || null);
    setGlobalDiscount({ type: "PERCENT", value: 0 });
    setSaleDate(new Date().toISOString().slice(0, 10));
    setNote("");
    setCustomerReference("");
    setValidUntil("");
    setBillingChoice("NOT_INVOICED");
    setFulfillmentType(
      context?.settings?.sales?.default_fulfillment_type || "IMMEDIATE",
    );
    setDeliveryStatus("PREPARED");
    setDocumentType(
      context?.settings?.sales?.default_print_document || "TICKET",
    );
    setPrintFormat(
      context?.settings?.sales?.default_print_format || "THERMAL_80",
    );
    setSuspendedId(null);
    setRequestId(key());
    setMode("SALE");
    setSourceQuoteId(null);
    setSourceSaleId(null);
    setReturnSettlementMode("CUSTOMER_CREDIT");
    setDialog(null);
    setError("");
    focusSearch();
  }
  async function openSuspended() {
    try {
      setDialog({
        type: "suspended",
        sales: await getSuspendedSales(warehouseId),
      });
    } catch (e) {
      setError(e.message);
    }
  }
  async function resume(id) {
    try {
      const sale = await getPosSale(id);
      setLines(sale.lines.map((line) => ({ ...line, key: key() })));
      setCustomer(
        sale.customer_id
          ? { id: sale.customer_id, name: sale.customer_name }
          : null,
      );
      setGlobalDiscount({
        type: sale.global_discount_type || "PERCENT",
        value: sale.global_discount_value ?? sale.global_discount_percent,
      });
      setSaleDate(sale.sale_date || new Date().toISOString().slice(0, 10));
      setNote(sale.note || "");
      setCustomerReference(sale.customer_reference || "");
      setFulfillmentType(sale.fulfillment_type || "IMMEDIATE");
      setSuspendedId(sale.id);
      setDialog(null);
      focusSearch();
    } catch (e) {
      setError(e.message);
    }
  }
  async function cashMovement(data) {
    try {
      const sessionId = context.cash_session?.id || cashSession?.id;
      if (!sessionId) throw new Error(t("noOpenSession"));
      setSaving(true);
      const next = await createCashMovement(sessionId, data);
      await onSaleFinalized?.();
      setContext((current) => ({ ...current, cash_session: next }));
      setDialog(null);
      focusSearch();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    const handler = (e) => {
      if (dialog) {
        if (dialog.type === "cancel-sale" && e.key === "Enter") {
          e.preventDefault();
          newSale();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setDialog(null);
          focusSearch();
        }
        return;
      }
      if (e.ctrlKey && e.key === "Delete") {
        e.preventDefault();
        if (lines.length) setDialog({ type: "cancel-sale" });
        return;
      }
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (mode === "SALE" && fulfillmentType === "IMMEDIATE") quickCheckout();
        return;
      }
      if (e.key === "Enter") {
        if (document.activeElement === searchRef.current) return;
        const cartRow = document.activeElement?.closest?.(
          "[data-pos-cart-row]",
        );
        if (cartRow && lines[selected]) {
          e.preventDefault();
          openArticle("quantity");
        }
        return;
      }
      const tag = e.target.tagName;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(tag) &&
        !/^F\d+$/.test(e.key)
      ) {
        return;
      }
      const actions = {
        F2: () => setDialog({ type: "customer" }),
        F3: () => setDialog({ type: "misc" }),
        F1: focusSearch,
        F4: () => openArticle("quantity"),
        F5: () => openArticle("unit"),
        F6: () => openArticle("discount"),
        F7: () => settings.allow_discount && setDialog({ type: "global" }),
        F8: () =>
          lines.length &&
          (editingSale
            ? setDialog({ type: "edit-confirm" })
            : mode === "QUOTE"
              ? recordQuote()
              : mode === "RETURN"
                ? recordReturn()
                : requiresDelivery
                  ? setDialog({ type: "b2b-confirm" })
                  : setDialog({ type: "payment" })),
        F9: suspend,
        F10: openSuspended,
        F11: () => setDialog({ type: "document" }),
        Delete: () => lines[selected] && remove(selected),
        ArrowUp: () => setSelected((index) => Math.max(0, index - 1)),
        ArrowDown: () =>
          setSelected((index) => Math.min(lines.length - 1, index + 1)),
        "+": () =>
          lines[selected] &&
          patchSelected({ quantity: Number(lines[selected].quantity) + 1 }),
        "-": () =>
          lines[selected] &&
          Number(lines[selected].quantity) > 1 &&
          patchSelected({ quantity: Number(lines[selected].quantity) - 1 }),
      };
      if (actions[e.key]) {
        e.preventDefault();
        actions[e.key]();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    dialog,
    lines,
    selected,
    context,
    customer,
    globalDiscount,
    saving,
    summary.total,
    query,
    requestId,
    mode,
    requiresDelivery,
  ]);
  if (!context)
    return (
      <div className="p-6">
        <ErrorMessage message={error} />
        {t("loading")}
      </div>
    );
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f7f5] p-3 text-black">
      {feedback && (
        <div className="fixed right-5 top-20 z-50 min-w-[280px] border border-green-700 bg-white px-5 py-4 shadow-lg">
          <p className="text-[12px] font-semibold text-green-800">
            {t("saleRecorded")} {feedback.saleNumber}
          </p>
          {feedback.change > 0 && (
            <p className="mt-2 text-[20px] font-bold text-black">
              {t("changeDue")}: {formatMoney(feedback.change, language)}
            </p>
          )}
        </div>
      )}
      <ErrorMessage message={error} />
      <div className="relative flex h-11 shrink-0 border border-gray-400 bg-white">
        <Search className="m-3" size={18} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => doSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((i) => Math.min(results.length - 1, i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              handleSearchEnter();
            }
            if (e.key === "Escape") {
              setResults([]);
              setHighlight(-1);
            }
          }}
          placeholder={t("scanSearchProduct")}
          className="min-w-0 flex-1 text-[14px] font-medium outline-none"
        />
        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-[44px] z-30 max-h-[260px] overflow-auto border border-gray-400 bg-white shadow-lg">
            {results.map((item, i) => (
              <button
                key={`${item.product_unit_id}-${item.barcode || i}`}
                type="button"
                onClick={() => addProduct(item)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex h-12 w-full items-center justify-between border-b px-4 text-left text-[12px] ${i === highlight ? "bg-green-50" : ""}`}
              >
                <span>
                  <b>{item.designation}</b>{" "}
                  <small>
                    {item.unit_name} {item.barcode}
                  </small>
                </span>
                <b>{formatMoney(item.selling_price, language)}</b>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="my-2 flex shrink-0 gap-2 overflow-visible">
        {[
          ["F2", t("customer"), () => setDialog({ type: "customer" })],
          ["F3", t("miscItem"), () => setDialog({ type: "misc" })],
          ["F4", t("editItem"), () => openArticle("quantity")],
          ["F7", t("globalDiscount"), () => setDialog({ type: "global" })],
          ["F9", t("suspend"), suspend],
          ["F10", t("resume"), openSuspended],
        ].map(([f, label, action]) => (
          <button
            key={f}
            type="button"
            onClick={action}
            className="h-9 shrink-0 border border-gray-300 bg-white px-3 text-[11px] font-semibold"
          >
            <b className="me-1 text-[#087c1e]">{f}</b>
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDialog({ type: "document" })}
          className="flex h-9 min-w-0 shrink items-center gap-2 border border-gray-300 bg-white px-3 text-[11px] font-semibold"
          title={t("Options du document")}
        >
          <b className="shrink-0 text-[#087c1e]">F11</b>
          <span className="hidden xl:inline">{t("Document")}</span>
          <span className="max-w-36 truncate font-bold">{documentLabel}</span>
          <ChevronDown className="shrink-0" size={14} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setDialog(
                dialog?.type === "cash-menu" ? null : { type: "cash-menu" },
              )
            }
            className="flex h-9 items-center gap-2 border border-gray-300 bg-white px-3 text-[11px] font-semibold"
          >
            {t("cashRegisterModule")}
            <ChevronDown size={14} />
          </button>
          {dialog?.type === "cash-menu" && (
            <div className="absolute left-0 top-10 z-30 w-48 border border-gray-400 bg-white shadow-lg">
              {[
                [t("cashIn"), () => setDialog({ type: "cash-in" })],
                [t("cashOut"), () => setDialog({ type: "cash-out" })],
                [t("cashState"), () => setDialog({ type: "cash-state" })],
              ].map(([label, action]) => (
                <button
                  key={label}
                  onClick={action}
                  className="block h-10 w-full border-b px-3 text-left text-[11px] font-semibold"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* <button
          type="button"
          onClick={() => setDialog({ type: "more" })}
          className="flex h-9 items-center gap-2 border border-gray-300 bg-white px-3 text-[11px] font-semibold"
        >
          <MoreHorizontal size={15} />
          {t("more")}
        </button> */}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] gap-3">
        {mode === "RETURN" ? (
          <div className="min-h-0 overflow-auto border border-gray-300 bg-white">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-gray-100">
                <tr className="h-11 border-b">
                  <th className="px-3">{t("Article")}</th>
                  <th className="px-3 text-right">{t("Vendue")}</th>
                  <th className="px-3 text-right">{t("Déjà retournée")}</th>
                  <th className="px-3 text-right">{t("available")}</th>
                  <th className="px-3 text-right">{t("back")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.key} className="h-12 border-b">
                    <td className="px-3 font-semibold">{line.designation}</td>
                    <td className="px-3 text-right">{line.sold_quantity}</td>
                    <td className="px-3 text-right">
                      {line.returned_quantity || 0}
                    </td>
                    <td className="px-3 text-right">
                      {line.returnable_quantity}
                    </td>
                    <td className="px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        max={line.returnable_quantity}
                        step="0.001"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((current) =>
                            current.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    quantity: Math.min(
                                      Number(line.returnable_quantity),
                                      Math.max(0, Number(e.target.value) || 0),
                                    ),
                                  }
                                : row,
                            ),
                          )
                        }
                        className="h-9 w-24 border border-gray-400 px-2 text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CartTable
            lines={preview}
            selected={selected}
            onSelect={setSelected}
            onRemove={remove}
            onEditPrice={(index) => {
              openArticle("quantity", index);
            }}
            warningDays={context.settings.expiration.warning_days}
            language={language}
            t={t}
          />
        )}
        <aside className="flex min-h-0 flex-col border border-gray-300 bg-white">
          <div className="border-b px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase text-black/50">
              {t("customer")}
            </p>
            <button
              onClick={() => setDialog({ type: "customer" })}
              className="mt-1 flex min-h-7 w-full items-center gap-2 text-left text-[13px] font-bold"
            >
              <UserRound size={16} />
              {customer?.name || t("noCustomer")}
            </button>
            {customer?.phone && (
              <p className="mt-1 text-[11px] text-black/50">{customer.phone}</p>
            )}
          </div>
          <div className="space-y-1.5 px-4 py-3 text-[12px]">
            <Row
              label={t("subtotal")}
              value={formatMoney(summary.subtotal, language)}
            />
            <Row
              label={t("lineDiscounts")}
              value={formatMoney(summary.lineDiscount, language)}
            />
            <Row
              label={t("globalDiscount")}
              value={formatMoney(summary.globalAmount, language)}
            />
            {mode === "RETURN" && (
              <div className="mt-4 space-y-2 border-t border-gray-200 pt-3">
                <p className="text-[10px] font-bold uppercase text-black/50">
                  {t("Règlement du retour")}
                </p>
                <select
                  value={returnSettlementMode}
                  onChange={(event) => setReturnSettlementMode(event.target.value)}
                  className={inputClass}
                >
                  <option value="CUSTOMER_CREDIT">{t("Créer un avoir / crédit client")}</option>
                  <option value="REFUND">{t("Rembourser en espèces")}</option>
                </select>
                {returnSettlementMode === "REFUND" && (
                  <select
                    value={refundPaymentMethodCode}
                    onChange={(event) => setRefundPaymentMethodCode(event.target.value)}
                    className={inputClass}
                  >
                    {(context?.payment_methods || [])
                      .filter((method) => method.affects_cash_drawer)
                      .map((method) => (
                        <option key={method.code} value={method.code}>
                          {method.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}
          </div>
          <div className="mt-auto border-t-2 border-black bg-white p-4 text-center">
            <p className="text-[11px] font-black uppercase">
              {mode === "RETURN" ? t("Montant retourné") : t("totalDue")}
            </p>
            <p className="mt-1.5 text-[34px] font-black leading-none">
              {formatMoney(
                mode === "RETURN"
                  ? lines.reduce(
                      (sum, line) =>
                        sum +
                        Number(line.quantity || 0) *
                          Number(line.return_unit_total || 0),
                      0,
                    )
                  : summary.total,
                language,
              )}
            </p>
            <button
              disabled={!lines.length || saving}
              onClick={() =>
                editingSale
                  ? setDialog({ type: "edit-confirm" })
                  : mode === "QUOTE"
                    ? recordQuote()
                    : mode === "RETURN"
                      ? recordReturn()
                      : requiresDelivery
                        ? setDialog({ type: "b2b-confirm" })
                        : setDialog({ type: "payment" })
              }
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-[#099323] text-[15px] font-bold text-white disabled:opacity-40"
            >
              <Banknote size={20} />
              F8{" "}
              {editingSale
                ? t("ENREGISTRER LES MODIFICATIONS")
                : mode === "QUOTE"
                  ? t("ENREGISTRER LE DEVIS")
                  : mode === "RETURN"
                    ? t("VALIDER LE RETOUR")
                    : requiresDelivery
                      ? t("VALIDER LE BL")
                      : t("payment")}
            </button>
            {settings.quick_checkout_enabled && (
              <p className="mt-2 text-[10px] font-semibold text-black/50">
                Ctrl+Enter · {t("quickExactPayment")}
              </p>
            )}
          </div>
        </aside>
      </div>
      <Modal
        open={dialog?.type === "edit-confirm"}
        title={`Modifier ${initialEditSale?.sale_number || ""}`}
        onClose={() => setDialog(null)}
        width="md"
        footer={
          <>
            <Button onClick={() => setDialog(null)}>{t("cancel")}</Button>
            <Button variant="primary" onClick={saveSaleEdit} disabled={saving}>
              {t("Enregistrer les modifications")}
            </Button>
          </>
        }
      >
        <div className="space-y-4 p-5 text-[12px]">
          <div className="grid grid-cols-2 gap-4 border border-gray-200 bg-gray-50 p-4">
            <div>
              <span className="block text-[10px] uppercase text-black/45">
                {t("Ancien total")}
              </span>
              <b className="mt-1 block tabular-nums">
                {formatMoney(initialEditSale?.total || 0, language)}
              </b>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-black/45">
                {t("Nouveau total")}
              </span>
              <b className="mt-1 block tabular-nums">
                {formatMoney(summary.total, language)}
              </b>
            </div>
          </div>
          <p>
            {t("Articles actuels :")} <b>{lines.length}</b>
          </p>
          <p>
            {t("Articles modifiés :")} <b>{editImpact.changed}</b>
          </p>
          {!!editImpact.stock.length && (
            <div className="border border-gray-200">
              <div className="border-b bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase text-black/50">
                {t("Impact stock")}
              </div>
              {editImpact.stock.map((item) => (
                <div
                  key={item.designation}
                  className="flex justify-between border-b px-3 py-2 last:border-b-0"
                >
                  <span>{item.designation}</span>
                  <b>
                    {item.delta > 0
                      ? `${t("Sortie supplémentaire")} ${item.delta}`
                      : `${t("Remise en stock")} ${Math.abs(item.delta)}`}
                  </b>
                </div>
              ))}
            </div>
          )}
          <p className="text-black/55">
            {t("Les paiements et retours existants seront conservés. Seule la différence de stock sera appliquée.")}
          </p>
        </div>
      </Modal>
      <Modal
        open={dialog?.type === "document"}
        title={t("Document")}
        onClose={() => setDialog(null)}
        width="sm"
        footer={
          <Button
            onClick={() => {
              setDialog(null);
              focusSearch();
            }}
          >
            {t("close")}
          </Button>
        }
      >
        <div className="space-y-4 p-5">
          <DialogField label={t("Opération")}>
            <select
              value={mode}
              onChange={(e) => {
                changeOperation(e.target.value);
              }}
              className={inputClass}
            >
              <option value="SALE">{t("Vente")}</option>
              <option value="QUOTE">{t("quotes")}</option>
              <option value="RETURN">{t("back")}</option>
            </select>
          </DialogField>
          {mode === "SALE" && (
            <DialogField label={t("Mode")}>
              <select
                value={fulfillmentType}
                disabled={Boolean(editingSale)}
                onChange={(e) => {
                  const value = e.target.value;
                  changeFulfillmentType(value);
                }}
                className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-100`}
              >
                <option value="IMMEDIATE">{t("Vente immédiate")}</option>
                <option value="SHIPPING">{t("delivery")}</option>
              </select>
            </DialogField>
          )}
          {mode === "SALE" && fulfillmentType === "SHIPPING" && (
            <DialogField label={t("shippingStatus")}>
              <select
                value={deliveryStatus}
                onChange={(e) => setDeliveryStatus(e.target.value)}
                className={inputClass}
                disabled={editingSale}
              >
                <option value="PREPARED">{t("deliveryPrepared")}</option>
                <option value="SHIPPED">{t("deliveryShipped")}</option>
                <option value="DELIVERED">{t("deliveryDelivered")}</option>
              </select>
            </DialogField>
          )}
          <DialogField label={t("Document")}>
            {mode === "SALE" ? (
              fulfillmentType === "SHIPPING" ? (
                <div className={`${inputClass} flex items-center bg-gray-50`}>{t("Bon de livraison")}</div>
              ) : (
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className={inputClass}
              >
                <option value="TICKET">{t("TICKET")}</option>
                <option value="BON_POUR">{t("SALE_INVOICE")}</option>
              </select>
              )
            ) : (
              <div className={`${inputClass} flex items-center bg-gray-50`}>
                {documentLabel}
              </div>
            )}
          </DialogField>
          {mode === "SALE" && (
            <DialogField label={t("invoicingSettings")}>
              <select
                value={billingChoice}
                onChange={(event) => setBillingChoice(event.target.value)}
                disabled={Boolean(editingSale && initialEditSale?.invoice)}
                className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-100`}
              >
                <option value="NOT_INVOICED">{t("Non facturé")}</option>
                <option value="INVOICE">{t("Facturé")}</option>
              </select>
            </DialogField>
          )}
          {mode === "QUOTE" && (
            <DialogField label={t("Validité")}>
              <input
                type="date"
                min={saleDate}
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
                className={inputClass}
              />
            </DialogField>
          )}
          <DialogField label={t("Format")}>
            <select
              value={printFormat}
              onChange={(e) => setPrintFormat(e.target.value)}
              disabled={!context.settings.printing?.allow_format_override}
              className={inputClass}
            >
              <option value="NONE">{t("NONE")}</option>
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="THERMAL_80">{t("THERMAL_80")}</option>
              <option value="THERMAL_58">{t("THERMAL_58")}</option>
            </select>
          </DialogField>
          <DialogField label={t("saleDate")}>
            <CompactFrenchDateInput
              value={saleDate}
              disabled={!context.permissions?.can_backdate_sale}
              onChange={setSaleDate}
            />
          </DialogField>
          {(sourceQuoteId || sourceSaleId) && (
            <div className="text-[10px] font-semibold text-[#087c1e]">
              {t("Origine :")}{" "}
              {initialQuote?.quote_number ||
                initialReturnSale?.document_number ||
                initialReturnSale?.sale_number}
            </div>
          )}
        </div>
      </Modal>
      <MiscDialog
        open={dialog?.type === "misc"}
        onClose={() => setDialog(null)}
        onAdd={(form) => {
          if (
            !form.designation ||
            Number(form.quantity) <= 0 ||
            Number(form.unit_price) < 0
          )
            return;
          setLines((rows) => [
            ...rows,
            {
              ...form,
              key: key(),
              quantity: Number(form.quantity),
              unit_price: Number(form.unit_price),
              discount_percent: 0,
              conversion_factor: 1,
            },
          ]);
          setSelected(lines.length);
          setDialog(null);
          focusSearch();
        }}
        t={t}
      />
      <SerialSelectionDialog
        open={!!serialPicker.product}
        product={serialPicker.product}
        serials={serialPicker.serials}
        loading={serialPicker.loading}
        saving={serialPicker.saving}
        error={serialPicker.error}
        onClose={() => {
          setSerialPicker({ product: null, serials: [], loading: false, saving: false, error: "" });
          focusSearch();
        }}
        onSelect={(serialId) => {
          const serial = serialPicker.serials.find((item) => Number(item.id) === Number(serialId));
          if (!serial) return;
          commitProduct(serialPicker.product, serial);
          setSerialPicker({ product: null, serials: [], loading: false, saving: false, error: "" });
        }}
        onAdd={async (serialNumber) => {
          setSerialPicker((current) => ({ ...current, saving: true, error: "" }));
          try {
            const serial = await addPosProductSerial(serialPicker.product.product_id, {
              warehouse_id: warehouseId,
              serial_number: serialNumber,
            });
            setSerialPicker((current) => ({
              ...current,
              serials: [...current.serials, serial],
              saving: false,
            }));
            return serial;
          } catch (e) {
            setSerialPicker((current) => ({ ...current, saving: false, error: e.message }));
            return null;
          }
        }}
        t={t}
      />
      <BatchSelectionDialog
        open={!!batchPicker.product}
        product={batchPicker.product}
        batches={batchPicker.batches}
        loading={batchPicker.loading}
        error={batchPicker.error}
        onClose={() => {
          setBatchPicker({ product: null, batches: [], loading: false, error: "" });
          focusSearch();
        }}
        onSelect={(batch) => {
          commitProduct(batchPicker.product, null, batch);
          setBatchPicker({ product: null, batches: [], loading: false, error: "" });
        }}
        t={t}
      />
      <Modal
        open={dialog?.type === "tracking-reset-warning"}
        title={t("Articles à saisir à nouveau")}
        onClose={() => { setDialog(null); focusSearch(); }}
        width="sm"
        footer={<Button variant="primary" onClick={() => { setDialog(null); focusSearch(); }}>{t("Compris")}</Button>}
      >
        <p className="p-5 text-[12px]">{t("Le passage de Devis à Vente a vidé le panier. Ajoutez de nouveau les articles afin de sélectionner les numéros de série ou les lots corrects.")}</p>
      </Modal>
      <ArticleEditor
        open={dialog?.type === "article"}
        line={lines[selected]}
        units={articleUnits}
        focus={dialog?.focus}
        settings={settings}
        onClose={() => {
          setDialog(null);
          focusSearch();
        }}
        onConfirm={(form) => {
          if (Number(form.quantity) > 0)
            patchSelected({
              ...form,
              quantity: Number(form.quantity),
              unit_price: Number(form.unit_price),
              discount_value: Number(form.discount_value || 0),
            });
        }}
        language={language}
        t={t}
      />
      <DiscountDialog
        open={dialog?.type === "global"}
        title={t("globalDiscount")}
        discount={globalDiscount}
        maximum={settings.max_discount_percent}
        onClose={() => setDialog(null)}
        onConfirm={(discount) => {
          if (discount.value >= 0) {
            setGlobalDiscount(discount);
            setDialog(null);
            focusSearch();
          }
        }}
        t={t}
      />
      <CashMovementDialog
        open={["cash-in", "cash-out"].includes(dialog?.type)}
        direction={dialog?.type === "cash-out" ? "OUT" : "IN"}
        session={context.cash_session || cashSession}
        onClose={() => setDialog(null)}
        onConfirm={cashMovement}
        saving={saving}
        language={language}
        t={t}
      />
      <Modal
        open={dialog?.type === "cash-state"}
        title={t("cashState")}
        onClose={() => setDialog(null)}
        width="sm"
        footer={<Button onClick={() => setDialog(null)}>{t("close")}</Button>}
      >
        <div className="space-y-3 p-5 text-[12px]">
          <Row
            label={t("cashRegister")}
            value={
              (context.cash_session || cashSession)?.cash_register_name || "-"
            }
          />
          <Row
            label={t("openingCash")}
            value={formatMoney(
              (context.cash_session || cashSession)?.opening_cash || 0,
              language,
            )}
          />
          <Row
            label={t("cashSales")}
            value={formatMoney(
              (context.cash_session || cashSession)?.cash_sales_total || 0,
              language,
            )}
          />
          <Row
            label={t("manualCashIn")}
            value={formatMoney(
              (context.cash_session || cashSession)?.manual_in_total || 0,
              language,
            )}
          />
          <Row
            label={t("manualCashOut")}
            value={formatMoney(
              (context.cash_session || cashSession)?.manual_out_total || 0,
              language,
            )}
          />
          <Row
            label={t("theoreticalCash")}
            value={formatMoney(
              (context.cash_session || cashSession)?.expected_cash || 0,
              language,
            )}
          />
        </div>
      </Modal>
      <Modal
        open={dialog?.type === "more"}
        title={t("more")}
        onClose={() => setDialog(null)}
        width="sm"
        footer={
          <>
            <Button onClick={() => setDialog(null)}>{t("cancel")}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setDialog(null);
                focusSearch();
              }}
            >
              {t("save")}
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          {mode !== "QUOTE" && <label className="block text-[11px] font-semibold">
            {t("observation")}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 min-h-20 w-full border border-gray-400 p-3"
            />
          </label>}
          <label className="block text-[11px] font-semibold">
            {t("customerReference")}
            <input
              value={customerReference}
              onChange={(e) => setCustomerReference(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          {lastSale && (
            <button
              onClick={() =>
                window.electronAPI?.printSale?.(lastSale, {
                  ...(context.print_profiles.find(
                    (profile) =>
                      profile.document_type ===
                      profileTypeForDocument(documentType),
                  ) || context.print_profiles.find(
                    (profile) => profile.document_type === "SALE",
                  )),
                  document_type: documentType,
                  paper_format: printFormat === "NONE"
                    ? (documentType === "TICKET" ? "THERMAL_80" : "A4")
                    : printFormat,
                })
              }
              className="block text-[11px] font-semibold text-[#087c1e]"
            >
              {t("reprint")}
            </button>
          )}
          <button
            onClick={() => {
              if (lines.length) setDialog({ type: "cancel-sale" });
            }}
            className="text-[11px] font-semibold text-red-700"
          >
            {t("cancelSale")}
          </button>
        </div>
      </Modal>
      <Modal
        open={dialog?.type === "cancel-sale"}
        title={t("cancelSaleQuestion")}
        onClose={() => {
          setDialog(null);
          focusSearch();
        }}
        width="sm"
        footer={
          <>
            <Button
              onClick={() => {
                setDialog(null);
                focusSearch();
              }}
            >
              {t("back")}
            </Button>
            <Button variant="danger" onClick={newSale}>
              {t("cancelSale")}
            </Button>
          </>
        }
      >
        <div className="space-y-2 p-5 text-[13px]">
          <p>{t("cancelSaleItemsWarning")}</p>
          <p>{t("cancelSaleNoRecord")}</p>
        </div>
      </Modal>
      <PaymentDialog
        open={dialog?.type === "payment"}
        total={summary.total}
        methods={context.payment_methods}
        settings={context.settings.payments}
        onClose={() => setDialog(null)}
        onConfirm={pay}
        saving={saving}
        language={language}
        t={t}
        customer={customer}
      />
      <Modal
        open={dialog?.type === "b2b-confirm"}
        title={t("Valider la vente")}
        onClose={() => setDialog(null)}
        width="sm"
        footer={
          <>
            <Button onClick={() => setDialog(null)}>{t("cancel")}</Button>
            <Button onClick={() => setDialog({ type: "payment" })}>
              {t("Ajouter un règlement")}
            </Button>
            <Button variant="primary" onClick={() => pay([])} disabled={saving}>
              {t("Valider sans règlement")}
            </Button>
          </>
        }
      >
        <div className="p-5 text-[12px]">
          {deliveryStatus === "PREPARED"
            ? t("preparedDeliveryStockNotice")
            : t("shippedDeliveryStockNotice")}
        </div>
      </Modal>
      <Chooser
        dialog={dialog}
        onClose={() => setDialog(null)}
        onCustomer={setCustomer}
        onUnit={(u) =>
          patchSelected({
            product_unit_id: u.product_unit_id,
            unit_name: u.unit_name,
            conversion_factor: u.conversion_factor,
            unit_price: u.selling_price,
            barcode: u.barcode,
          })
        }
        onResume={resume}
        defaultCustomer={context.default_customer}
        allowUnspecifiedCustomer={
          context.settings.sales.allow_default_customer
        }
        language={language}
        t={t}
      />
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
function Chooser({
  dialog,
  onClose,
  onCustomer,
  onUnit,
  onResume,
  defaultCustomer,
  allowUnspecifiedCustomer,
  language,
  t,
}) {
  const [q, setQ] = useState(""),
    [customers, setCustomers] = useState([]),
    [highlight, setHighlight] = useState(0);
  useEffect(() => {
    if (dialog?.type !== "customer") return;
    const timer = setTimeout(
      () =>
        searchPosCustomers(q).then((items) => {
          setCustomers(items);
          setHighlight(0);
        }),
      250,
    );
    return () => clearTimeout(timer);
  }, [dialog?.type, q]);
  const choices = q ? customers : defaultCustomer ? [defaultCustomer] : [];
  return (
    <Modal
      open={["customer", "units", "suspended"].includes(dialog?.type)}
      title={
        dialog?.type === "customer"
          ? t("selectCustomer")
          : dialog?.type === "units"
            ? t("selectUnit")
            : t("suspendedSales")
      }
      onClose={onClose}
      width="md"
    >
      <div className="p-4">
        {dialog?.type === "customer" && (
          <>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={inputClass}
              placeholder={t("search")}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((i) => Math.min(choices.length - 1, i + 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((i) => Math.max(0, i - 1));
                }
                if (e.key === "Enter" && choices[highlight]) {
                  onCustomer(choices[highlight]);
                  onClose();
                }
              }}
            />
            {allowUnspecifiedCustomer && (
              <button
                type="button"
                onClick={() => {
                  onCustomer(null);
                  onClose();
                }}
                className="flex min-h-12 w-full items-center border-b px-2 text-left text-[12px]"
              >
                {t("noCustomer")}
              </button>
            )}
            {choices.map((c, index) => (
              <button
                key={c.id}
                onClick={() => {
                  onCustomer(c);
                  onClose();
                }}
                className={`flex min-h-12 w-full items-center justify-between border-b px-2 text-left text-[12px] ${index === highlight ? "bg-green-50" : ""}`}
              >
                <b>{c.name}</b>
                <span className="text-black/50">{c.phone || c.nif}</span>
              </button>
            ))}
          </>
        )}
        {dialog?.type === "units" &&
          dialog.units.map((u) => (
            <button
              key={u.product_unit_id}
              onClick={() => onUnit(u)}
              className="flex h-11 w-full items-center justify-between border-b text-[12px]"
            >
              <b>{u.unit_name}</b>
              <span>x {u.conversion_factor}</span>
            </button>
          ))}
        {dialog?.type === "suspended" &&
          (!dialog.sales.length ? (
            <p>{t("noSuspendedSales")}</p>
          ) : (
            dialog.sales.map((s) => (
              <button
                key={s.id}
                onClick={() => onResume(s.id)}
                className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center border-b px-2 text-left text-[12px]"
              >
                <span>
                  <b>#ATT-{String(s.id).padStart(4, "0")}</b>
                  <small className="mt-1 block text-black/50">
                    {s.customer_name || t("noCustomer")} · {s.line_count}{" "}
                    {t("items")} · {s.user_name}
                  </small>
                </span>
                <span className="text-right">
                  <b>{formatMoney(s.total, language)}</b>
                  <small className="mt-1 block text-black/50">
                    {formatDateTime(s.created_at, language)}
                  </small>
                </span>
              </button>
            ))
          ))}
      </div>
    </Modal>
  );
}
