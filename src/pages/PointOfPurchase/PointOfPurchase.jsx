import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, ChevronDown, PackagePlus, Plus, Search, Truck, UserRound, X } from "lucide-react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ErrorMessage from "../../components/ui/ErrorMessage";
import { inputClass } from "../../components/ui/FormField";
import { formatMoney } from "../../utils/formatters";
import { getSettings } from "../../api/settings.model";
import { useLanguage } from "../../i18n/LanguageContext";
import { fuzzyIncludes } from "../../utils/search";
import { PurchaseArticleEditor } from "./PurchaseDialogs";
import { printPurchaseDirect } from "../Purchases/PurchasePrintDialog";
import CartTable from "../PointOfSale/CartTable";
import { PaymentDialog, SerialSelectionDialog } from "../PointOfSale/PosDialogs";
import {
  createPurchaseOrder, createPurchaseReceipt, createSupplier,
  getPurchaseContext, updatePurchaseReceipt, addPurchaseReceiptPayment,
} from "../../api/purchase.model";

const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
const Field = ({ label, children }) => <label className="block text-[11px] font-semibold"><span className="mb-1 block">{label}</span>{children}</label>;

export default function PointOfPurchase({ warehouseId, initialOrder, initialEditReceipt, onNavigate, onReceiptFinalized }) {
  const { language, t } = useLanguage();
  // Kept only for the existing button label; purchase receipts never create invoices.
  const billingChoice = "NOT_INVOICED";
  const searchRef = useRef(null);
  const receiptRequestId = useRef(uid("purchase-receipt"));
  const paymentRequestId = useRef(uid("purchase-payment"));
  const [context, setContext] = useState({ suppliers: [], products: [], payment_methods: [] });
  const [supplier, setSupplier] = useState(null), [query, setQuery] = useState(""), [lines, setLines] = useState([]), [selected, setSelected] = useState(0);
  const [documentMode, setDocumentMode] = useState("RECEIPT");
  const [documentDate, setDocumentDate] = useState(today()), [printFormat, setPrintFormat] = useState("NONE");
  const [dialog, setDialog] = useState(null), [saving, setSaving] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState(null);
  const [serialPicker, setSerialPicker] = useState({ product: null, serials: [], error: "" });
  const [pendingSerials, setPendingSerials] = useState([]);
  useEffect(() => {
    if (!warehouseId) return;
    Promise.all([getPurchaseContext(warehouseId), getSettings("purchases")]).then(([data, purchaseSettings]) => {
      setContext({ ...data, purchaseSettings });
      setPrintFormat(purchaseSettings.default_print_format || "NONE");
    }).catch((e) => setError(e.message));
  }, [warehouseId]);
  useEffect(() => {
    if (!initialOrder || initialEditReceipt) return;
    setSupplier({ id: initialOrder.supplier_id, name: initialOrder.supplier_name });
    setDocumentMode("RECEIPT");
    setLines((initialOrder.lines || []).filter((line) => Number(line.remaining_quantity) > 0).map((line) => ({
      key: line.id, purchase_order_line_id: line.id, product_id: line.product_id, product_unit_id: line.product_unit_id,
      designation: line.designation, reference: line.reference, unit_name: line.unit_name, quantity: line.remaining_quantity,
      max_quantity: line.remaining_quantity, unit_price: line.unit_price, track_serials: line.track_serials,
      track_batches: line.track_batches, track_expiration: line.track_expiration, serial_numbers: [], batch_number: "", expiration_date: "",
    })));
  }, [initialOrder]);
  useEffect(() => {
    if (!initialEditReceipt) return;
    setSupplier({ id: initialEditReceipt.supplier_id, name: initialEditReceipt.supplier_name });
    setDocumentMode("RECEIPT");
    setDocumentDate(initialEditReceipt.receipt_date || today());
    setLines((initialEditReceipt.lines || []).map((line) => ({
      ...line,
      key: line.id,
      quantity: Number(line.quantity),
      unit_price: Number(line.unit_price || 0),
      serial_numbers: line.serial_numbers || [],
      batch_number: line.batch_number || "",
      expiration_date: line.expiration_date || "",
    })));
  }, [initialEditReceipt]);
  const results = useMemo(() => {
    if (!query.trim()) return [];
    return context.products
      .filter((product) =>
        fuzzyIncludes(
          query,
          product.designation,
          product.reference,
          product.barcodes,
          product.unit_name,
        ),
      )
      .slice(0, 12);
  }, [context.products, query]);
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0), [lines]);
  const cartLines = useMemo(() => lines.map((line) => ({
    ...line,
    track_stock: false,
    discount_type: "PERCENT",
    discount_value: 0,
    preview_total: Number(line.quantity || 0) * Number(line.unit_price || 0),
  })), [lines]);
  function commitProduct(product, trace = {}) {
    setLines((current) => {
      const index = current.findIndex((line) => Number(line.product_unit_id) === Number(product.product_unit_id) && !line.purchase_order_line_id);
      if (index >= 0 && !product.track_serials && !product.track_batches) return current.map((line, i) => i === index ? { ...line, quantity: Number(line.quantity) + 1 } : line);
      return [...current, { key: `${product.product_unit_id}:${Date.now()}`, product_id: product.id, product_unit_id: product.product_unit_id, designation: product.designation, reference: product.reference, unit_name: product.unit_name, quantity: Number(trace.quantity || 1), unit_price: product.purchase_price || 0, track_serials: product.track_serials, track_batches: product.track_batches, track_expiration: product.track_expiration, serial_numbers: trace.serial_numbers || [], batch_number: trace.batch_number || "", expiration_date: trace.expiration_date || "" }];
    });
    setSelected(lines.length);
    setQuery(""); searchRef.current?.focus();
  }
  function addProduct(product) {
    if (documentMode === "RECEIPT" && product.track_serials) {
      setQuery("");
      setSerialPicker({ product, serials: [], error: "" });
      return;
    }
    if (documentMode === "RECEIPT" && product.track_batches) {
      setQuery("");
      setDialog({ type: "traceability", product });
      return;
    }
    commitProduct(product);
  }
  function patchLine(index, values) { setLines((current) => current.map((line, i) => i === index ? { ...line, ...values } : line)); }
  function reset() { setLines([]); setSupplier(null); setQuery(""); setDocumentDate(today()); setPrintFormat(context.purchaseSettings?.default_print_format || "NONE"); setSuccess(null); setError(""); receiptRequestId.current = uid("purchase-receipt"); paymentRequestId.current = uid("purchase-payment"); }
  function startSave() {
    if (saving) return;
    if (documentMode === "RECEIPT" && !initialEditReceipt) {
      if (!supplier) return setError(t("Sélectionnez un fournisseur."));
      if (!lines.length || lines.some((line) => !(Number(line.quantity) > 0))) return setError(t("Ajoutez au moins un article avec une quantité valide."));
      setDialog({ type: "payment" });
      return;
    }
    save();
  }
  async function save(payments = []) {
    if (saving) return;
    if (!supplier) return setError(t("Sélectionnez un fournisseur."));
    if (!lines.length || lines.some((line) => !(Number(line.quantity) > 0))) return setError(t("Ajoutez au moins un article avec une quantité valide."));
    try {
      setSaving(true); setError("");
      let printTarget = null;
      const baseLines = lines.map((line) => ({ ...line, quantity: Number(line.quantity), unit_price: Number(line.unit_price || 0) }));
      if (documentMode === "ORDER") {
        const order = await createPurchaseOrder({ client_request_id: uid("purchase-order"), warehouse_id: warehouseId, supplier_id: supplier.id, order_date: documentDate, print_format: printFormat, lines: baseLines });
        setSuccess({ number: order.order_number, label: t("Bon de commande créé") });
        printTarget = { document: order, kind: "ORDER" };
      } else {
        if (initialEditReceipt) {
          const receipt = await updatePurchaseReceipt(initialEditReceipt.id, { client_request_id: uid("purchase-receipt-edit"), warehouse_id: warehouseId, supplier_id: supplier.id, receipt_date: documentDate, lines: baseLines });
          await onReceiptFinalized?.();
          setSuccess({ number: receipt.receipt_number, label: t("Bon de réception modifié") });
        } else {
          let receipt = await createPurchaseReceipt({ client_request_id: receiptRequestId.current, purchase_order_id: initialOrder?.id || null, warehouse_id: warehouseId, supplier_id: supplier.id, receipt_date: documentDate, print_format: printFormat, lines: baseLines });
          if (Number(payments[0]?.amount) > 0)
            receipt = await addPurchaseReceiptPayment(receipt.id, {
              client_request_id: paymentRequestId.current,
              payment_method_code: payments[0].code,
              amount: Number(payments[0].amount),
            });
          await onReceiptFinalized?.();
          setDialog(null);
          setSuccess({ number: receipt.receipt_number, label: t("Bon de réception validé") });
          printTarget = { document: receipt, kind: "RECEIPT" };
        }
      }
      setLines([]);
      if (printTarget && printFormat !== "NONE") {
        try { await printPurchaseDirect(printTarget.document, printTarget.kind, printFormat); }
        catch (printError) { setError(`${t("printFailed")}: ${printError.message}`); }
      }
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  function openArticle(focus = "quantity", index = selected) {
    if (!lines[index]) return;
    setSelected(index);
    setDialog({ type: "article", index, focus });
  }
  function changeDocumentMode(value) {
    const mustReset = documentMode === "ORDER" && value === "RECEIPT" && lines.length;
    setDocumentMode(value);
    if (mustReset) {
      setLines([]);
      setSelected(0);
      setDialog({ type: "tracking-reset-warning" });
    }
  }
  useEffect(() => {
    const handler = (event) => {
      if (dialog) {
        if (event.key === "Escape") { event.preventDefault(); setDialog(null); searchRef.current?.focus(); }
        return;
      }
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        startSave();
        return;
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) && !/^F\d+$/.test(event.key)) return;
      const actions = {
        F1: () => searchRef.current?.focus(),
        F2: () => !initialEditReceipt && setDialog({ type: "supplier" }),
        F4: () => openArticle("quantity"),
        F8: startSave,
        F11: () => setDialog({ type: "document" }),
        Delete: () => lines[selected] && setLines((current) => current.filter((_, index) => index !== selected)),
        ArrowUp: () => setSelected((index) => Math.max(0, index - 1)),
        ArrowDown: () => setSelected((index) => Math.min(lines.length - 1, index + 1)),
      };
      if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dialog, lines, selected, supplier, documentMode, saving]);
  if (success) return <div className="flex h-full items-center justify-center bg-[#f5f7f5] p-8"><div className="w-full max-w-lg border border-green-300 bg-white p-8 text-center shadow-xl"><PackagePlus className="mx-auto text-green-600" size={52}/><h2 className="mt-4 text-xl font-black">{success.label}</h2><p className="mt-2 text-[15px] font-bold text-green-700">{success.number}</p><div className="mt-7 flex justify-center gap-3"><Button onClick={() => onNavigate("purchases")}>{t("Voir les achats")}</Button>{!initialEditReceipt && <Button variant="primary" onClick={reset}>{t("Nouveau document")}</Button>}</div></div></div>;
  return <div className="flex h-full min-h-0 flex-col bg-[#f5f7f5] p-3 text-black">
    <ErrorMessage message={error} onClose={() => setError("")}/>
    <div className="relative flex h-11 shrink-0 border border-gray-400 bg-white">
      <Search className="m-3" size={18}/><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Scanner ou rechercher un article à acheter")} className="min-w-0 flex-1 text-[14px] font-medium outline-none"/>
      {results.length > 0 && <div className="absolute left-0 right-0 top-[44px] z-30 max-h-[260px] overflow-auto border border-gray-400 bg-white shadow-lg">{results.map((product) => <button key={product.product_unit_id} onClick={() => addProduct(product)} className="flex h-12 w-full items-center justify-between border-b px-4 text-left text-[12px] hover:bg-green-50"><span><b>{product.designation}</b><small className="ml-2">{product.unit_name} {product.barcode}</small></span><b>{formatMoney(product.purchase_price, language)}</b></button>)}</div>}
    </div>
    <div className="my-2 flex shrink-0 gap-2 overflow-visible">
      <button disabled={Boolean(initialEditReceipt)} onClick={() => setDialog({ type: "supplier" })} className="h-9 shrink-0 border border-gray-300 bg-white px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:bg-gray-100"><b className="me-1 text-[#087c1e]">F2</b> {t("supplier")}</button>
      <button onClick={() => openArticle("quantity")} className="h-9 shrink-0 border border-gray-300 bg-white px-3 text-[11px] font-semibold"><b className="me-1 text-[#087c1e]">F4</b> {t("editItem")}</button>
      <button onClick={() => setDialog({ type: "document" })} className="flex h-9 items-center gap-2 border border-gray-300 bg-white px-3 text-[11px] font-semibold"><b className="text-[#087c1e]">F11</b><span>{t("Document")}</span><span className="font-bold">{documentMode === "ORDER" ? t("Bon de commande") : t("Bon de réception")}</span><ChevronDown size={14}/></button>
      <button onClick={() => onNavigate("purchases")} className="ml-auto h-9 border border-gray-300 bg-white px-3 text-[11px] font-semibold">{t("Quitter")}</button>
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,7fr)_minmax(310px,3fr)] gap-3">
      <CartTable lines={cartLines} selected={selected} onSelect={setSelected} onRemove={(index) => setLines((current) => current.filter((_, i) => i !== index))} onEditPrice={(index) => openArticle("quantity", index)} warningDays={30} language={language} t={t}/>
      <aside className="flex min-h-0 flex-col border border-gray-300 bg-white">
        <div className="border-b px-3 py-2.5"><p className="text-[10px] font-bold uppercase text-black/50">{t("supplier")}</p><button disabled={Boolean(initialEditReceipt)} onClick={() => setDialog({ type: "supplier" })} className="mt-1 flex min-h-7 w-full items-center gap-2 text-left text-[13px] font-bold disabled:cursor-not-allowed"><UserRound size={16}/>{supplier?.name || t("Aucun fournisseur")}</button>{supplier?.phone && <p className="mt-1 text-[11px] text-black/50">{supplier.phone}</p>}</div>
        <div className="space-y-1.5 px-4 py-3 text-[12px]"><Row label={t("subtotal")} value={formatMoney(total, language)}/><Row label={t("Remises articles")} value={formatMoney(0, language)}/><Row label={t("globalDiscount")} value={formatMoney(0, language)}/></div>
        <div className="mt-auto border-t-2 border-black bg-white p-4 text-center"><p className="text-[11px] font-black uppercase">{t("totalDue")}</p><p className="mt-1.5 text-[34px] font-black leading-none">{formatMoney(total, language)}</p><button disabled={saving || !lines.length} onClick={startSave} className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-[#099323] text-[15px] font-bold text-white disabled:opacity-40"><Banknote size={20}/>F8 {saving ? "ENREGISTREMENT…" : initialEditReceipt ? t("ENREGISTRER LES MODIFICATIONS") : documentMode === "ORDER" ? t("ENREGISTRER LA COMMANDE") : billingChoice === "INVOICED" ? t("VALIDER RÉCEPTION + FACTURE") : t("VALIDER LA RÉCEPTION")}</button></div>
      </aside>
    </div>
    <PaymentDialog open={dialog?.type === "payment"} total={total} methods={context.payment_methods} settings={{ default_method: "CASH" }} supplierMode onClose={() => !saving && setDialog(null)} onConfirm={(payments) => save(payments)} saving={saving} language={language} t={t} />
    <Modal open={dialog?.type === "document"} title={t("Document")} onClose={() => setDialog(null)} width="sm" footer={<Button onClick={() => { setDialog(null); searchRef.current?.focus(); }}>{t("close")}</Button>}>
      <div className="space-y-4 p-5">
        <Field label={t("Opération")}><div className={`${inputClass} flex items-center bg-gray-50`}>{t("Achat")}</div></Field>
        <Field label={t("Document")}><select className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-100`} value={documentMode} disabled={Boolean(initialOrder || initialEditReceipt)} onChange={(e) => changeDocumentMode(e.target.value)}><option value="ORDER">{t("PURCHASE_ORDER")}</option><option value="RECEIPT">{t("Bon de réception")}</option></select></Field>
        <Field label={t("Format")}><select className={inputClass} value={printFormat} onChange={(e) => setPrintFormat(e.target.value)}><option value="NONE">{t("NONE")}</option><option value="A4">A4</option><option value="A5">A5</option><option value="THERMAL_80">{t("THERMAL_80")}</option><option value="THERMAL_58">{t("THERMAL_58")}</option></select></Field>
        <Field label={t("Date d'achat")}><input type="date" className={inputClass} value={documentDate} onChange={(e) => setDocumentDate(e.target.value)}/></Field>
      </div>
    </Modal>
    <PurchaseTraceabilityDialog open={dialog?.type === "traceability"} product={dialog?.product} serialNumbers={pendingSerials} onClose={() => { setDialog(null); setPendingSerials([]); searchRef.current?.focus(); }} onConfirm={(trace) => { commitProduct(dialog.product, { ...trace, serial_numbers: pendingSerials.length ? pendingSerials : trace.serial_numbers }); setPendingSerials([]); setDialog(null); }} t={t}/>
    <SerialSelectionDialog open={!!serialPicker.product} product={serialPicker.product} serials={serialPicker.serials} loading={false} saving={false} error={serialPicker.error} creationOnly bulkCreation hideEmptyNotice onClose={() => { setSerialPicker({ product: null, serials: [], error: "" }); searchRef.current?.focus(); }} onSelect={() => {}} onAdd={async () => null} onAddMany={async (serialNumbers) => serialNumbers.map((serial_number, index) => ({ id: -(Date.now() + index), serial_number }))} onConfirmSerials={(serials) => { const serialNumbers = serials.map((serial) => serial.serial_number); if (serialPicker.product.track_batches) { setPendingSerials(serialNumbers); setDialog({ type: "traceability", product: serialPicker.product }); setSerialPicker({ product: null, serials: [], error: "" }); } else { commitProduct(serialPicker.product, { quantity: serialNumbers.length, serial_numbers: serialNumbers }); setSerialPicker({ product: null, serials: [], error: "" }); } }} t={t}/>
    <Modal open={dialog?.type === "tracking-reset-warning"} title={t("Articles à saisir à nouveau")} onClose={() => { setDialog(null); searchRef.current?.focus(); }} width="sm" footer={<Button variant="primary" onClick={() => { setDialog(null); searchRef.current?.focus(); }}>{t("Compris")}</Button>}><p className="p-5 text-[12px]">{t("Le passage de Bon de commande à Bon de réception a vidé le panier. Ajoutez de nouveau les articles afin de renseigner les numéros de série ou les lots corrects.")}</p></Modal>
    <PurchaseArticleEditor open={dialog?.type === "article"} line={dialog?.type === "article" ? lines[dialog.index] : null} units={dialog?.type === "article" && lines[dialog.index] ? [lines[dialog.index]] : []} focus={dialog?.focus} settings={{ allow_price_edit: true, allow_discount: false }} unitPriceKey="purchase_price" showStock={false} showPurchaseTracking={documentMode === "RECEIPT"} language={language} t={t} onClose={() => setDialog(null)} onConfirm={(value) => { patchLine(dialog.index, { ...value, quantity: Math.min(Number(lines[dialog.index]?.max_quantity || Infinity), Number(value.quantity) || 0), unit_price: Number(value.unit_price) || 0 }); setDialog(null); searchRef.current?.focus(); }}/>
    <SupplierDialog open={dialog?.type === "supplier"} context={context} setContext={setContext} onSelect={(value) => { setSupplier(value); setDialog(null); }} onClose={() => setDialog(null)} setError={setError}/>
  </div>;
}

function ReceiptTextIcon({ mode }) { return mode === "ORDER" ? <PackagePlus size={15}/> : <Truck size={15}/>; }
const Row = ({ label, value }) => <div className="flex items-center justify-between"><span className="text-black/60">{label}</span><b className="tabular-nums">{value}</b></div>;
function PurchaseTraceabilityDialog({ open, product, serialNumbers: selectedSerialNumbers = [], onClose, onConfirm, t }) {
  const [quantity, setQuantity] = useState(1), [serialText, setSerialText] = useState(""), [batchNumber, setBatchNumber] = useState(""), [expirationDate, setExpirationDate] = useState(""), [error, setError] = useState("");
  useEffect(() => { if (open) { setQuantity(selectedSerialNumbers.length || 1); setSerialText(""); setBatchNumber(""); setExpirationDate(""); setError(""); } }, [open, product?.product_unit_id, selectedSerialNumbers.length]);
  const serialNumbers = serialText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  function confirm() {
    const parsedQuantity = Number(quantity);
    if (!(parsedQuantity > 0)) return setError(t("La quantité doit être supérieure à zéro."));
    if (selectedSerialNumbers.length && parsedQuantity !== selectedSerialNumbers.length) return setError(t("La quantité doit correspondre au nombre de numéros de série."));
    if (product?.track_serials && !selectedSerialNumbers.length && serialNumbers.length !== parsedQuantity) return setError(t("Saisissez exactement un numéro de série par unité reçue."));
    if (product?.track_batches && !batchNumber.trim()) return setError(t("Le numéro de lot est obligatoire pour cet article."));
    onConfirm({ quantity: parsedQuantity, serial_numbers: serialNumbers, batch_number: batchNumber.trim(), expiration_date: expirationDate || null });
  }
  return <Modal open={open} title={product?.track_serials ? t("selectSerialNumber") : t("batchLot")} onClose={onClose} width="sm" footer={<><Button onClick={onClose}>{t("cancel")}</Button><Button variant="primary" onClick={confirm}>{t("addToCart")}</Button></>}><div className="space-y-4 p-5" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } if ((event.ctrlKey && event.key === "Enter") || (event.key === "Enter" && event.target.tagName !== "TEXTAREA")) { event.preventDefault(); confirm(); } }}><div className="border border-gray-200 bg-gray-50 p-3"><b className="block text-[13px]">{product?.designation}</b><span className="text-[11px] text-black/55">{product?.reference}</span></div>{error && <div className="border border-red-300 bg-red-50 p-3 text-[11px] font-semibold text-red-700">{error}</div>}<Field label={t("quantity")}><input autoFocus type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputClass}/></Field>{product?.track_serials && !selectedSerialNumbers.length && <Field label={`${t("serialNumbers")} · ${t("un par ligne")}`}><textarea rows={5} value={serialText} onChange={(event) => setSerialText(event.target.value)} className={`${inputClass} py-2`} placeholder={t("serialNumber")}/><p className="mt-1 text-[10px] text-black/50">{serialNumbers.length} / {quantity || 0}</p></Field>}{product?.track_batches && <><Field label={t("batchLot")}><input value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} className={inputClass}/></Field>{product.track_expiration && <Field label={t("expirationDate")}><input type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} className={inputClass}/></Field>}</>}</div></Modal>;
}
function SupplierDialog({ open, context, setContext, onSelect, onClose, setError }) {
  const { t } = useLanguage();
  const [name, setName] = useState(""), [query, setQuery] = useState(""), [highlight, setHighlight] = useState(0);
  const choices = (context.suppliers || []).filter((supplier) =>
    fuzzyIncludes(
      query,
      supplier.name,
      supplier.phone,
      supplier.email,
      supplier.nif,
      supplier.nis,
      supplier.rib,
    ),
  );
  async function add() { try { const supplier = await createSupplier({ name }); setContext({ ...context, suppliers: [...context.suppliers, supplier].sort((a,b) => a.name.localeCompare(b.name)) }); onSelect(supplier); } catch (e) { setError(e.message); } }
  return <Modal open={open} title={t("Sélectionner un fournisseur")} onClose={onClose} width="md"><div className="p-4"><input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setHighlight(0); }} className={inputClass} placeholder={t("Rechercher un fournisseur…")} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((i) => Math.min(choices.length - 1, i + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((i) => Math.max(0, i - 1)); } if (e.key === "Enter" && choices[highlight]) { onSelect(choices[highlight]); } }}/><div className="mt-2 max-h-64 overflow-auto">{choices.map((item,index) => <button key={item.id} onMouseEnter={() => setHighlight(index)} onClick={() => onSelect(item)} className={`flex min-h-12 w-full items-center justify-between border-b px-2 text-left text-[12px] ${index === highlight ? "bg-green-50" : ""}`}><b>{item.name}</b><span className="text-black/50">{item.phone || item.nif || ""}</span></button>)}{!choices.length && <p className="p-6 text-center text-[12px] text-black/45">{t("noSuppliers")}</p>}</div><div className="mt-4 border-t pt-4"><p className="mb-2 text-[10px] font-bold uppercase text-black/50">{t("Nouveau fournisseur")}</p><div className="flex"><input className={inputClass} placeholder={t("supplierName")} value={name} onChange={(e) => setName(e.target.value)}/><Button variant="primary" disabled={!name.trim()} onClick={add}><Plus size={14}/> {t("Ajouter")}</Button></div></div></div></Modal>;
}
