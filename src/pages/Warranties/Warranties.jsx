import { useEffect, useMemo, useState } from "react";
import { Eye, FilePenLine, MoreHorizontal, Plus, Printer, Search, ShieldCheck } from "lucide-react";
import { createWarranty, getWarranty, getWarrantyContext, getWarranties, updateWarranty } from "../../api/warranty.model";
import Button from "../../components/ui/Button";
import BusinessStatusBadge from "../../components/ui/BusinessStatusBadge";
import ErrorMessage from "../../components/ui/ErrorMessage";
import FormField, { inputClass } from "../../components/ui/FormField";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import PrintPreviewCanvas from "../../components/printing/PrintPreviewCanvas";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatDate, formatMoney } from "../../utils/formatters";
import { buildWarrantyPrintHtml } from "../../utils/warrantyPrintTemplate";

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (warehouseId) => ({
  warehouse_id: warehouseId, customer_id: "", customer_full_name: "", customer_phone: "",
  customer_email: "", customer_address: "", product_id: "", product_unit_id: "",
  product_nature: "", product_model: "", product_brand: "", serial_number: "",
  batch_number: "", invoiced_price: "", source_type: "SALE", source_reference: "", sale_date: today(),
  duration_value: 12, duration_unit: "MONTHS", note: "",
});

export default function Warranties({ warehouseId }) {
  const { t, language } = useLanguage();
  const [filters, setFilters] = useState({ search: "", status: "", page: 1, limit: 25 });
  const [data, setData] = useState({ items: [], pagination: { page: 1, pages: 1 } });
  const [context, setContext] = useState({ customers: [], products: [], sales: [], invoices: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const debouncedSearch = useDebouncedValue(filters.search);

  async function load() {
    if (!warehouseId) return;
    try {
      setLoading(true); setError("");
      setData(await getWarranties({ ...filters, warehouse_id: warehouseId }));
    } catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }
  async function loadContext() {
    try { setContext(await getWarrantyContext(warehouseId)); }
    catch (reason) { setError(reason.message); }
  }
  useEffect(() => { load(); }, [warehouseId, debouncedSearch, filters.status, filters.page]);
  useEffect(() => { if (warehouseId) loadContext(); }, [warehouseId]);
  useEffect(() => {
    if (!rowMenu) return undefined;
    const close = (event) => { if (!event.target.closest("[data-warranty-menu]")) setRowMenu(null); };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [rowMenu]);

  async function openDetail(id) {
    try { setError(""); setSelected(await getWarranty(id)); }
    catch (reason) { setError(reason.message); }
  }
  async function openEdit(id) {
    try {
      setError("");
      const warranty = await getWarranty(id);
      setForm({
        ...warranty,
        customer_id: warranty.customer_id || "",
        product_id: warranty.product_id || "",
        product_unit_id: warranty.product_unit_id || "",
        source_type: warranty.source_type || (warranty.invoice_reference ? "INVOICE" : "SALE"),
        source_reference: warranty.source_reference || warranty.invoice_reference || "",
      });
    } catch (reason) { setError(reason.message); }
  }
  async function openPrint(id, direct = false) {
    try {
      setError("");
      const warranty = await getWarranty(id);
      const profile = warranty.print_profile || { paper_format: "A4", configuration: {} };
      if (direct) await window.electronAPI?.printWarranty?.(warranty, { ...profile, auto_print: true });
      else setPreview({ warranty, profile });
    } catch (reason) { setError(reason.message); }
  }
  async function save(value) {
    try {
      setError("");
      if (value.id) await updateWarranty(value.id, value); else await createWarranty(value);
      setForm(null); await load();
    } catch (reason) { setError(reason.message); throw reason; }
  }

  return <div className="flex h-full flex-col bg-[#f5f7f5]">
    <main className="min-h-0 flex-1 overflow-auto p-6">
      <section className="border border-gray-300 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]"><ShieldCheck size={21}/></div>
            <div><h1 className="text-[17px] font-bold">{t("Garanties")}</h1><p className="mt-1 text-[12px] text-black/55">{t("Recherchez et gérez les garanties")}</p></div>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => setForm(emptyForm(warehouseId))}>{t("Nouvelle garantie")}</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 border-b border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_220px]">
          <label className="relative"><Search size={16} className="absolute start-3 top-[13px] text-black/45"/><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} placeholder={t("Rechercher une garantie, un client ou un produit")} className="h-[42px] w-full border border-gray-400 bg-white ps-9 pe-3 text-[12px] outline-none"/></label>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className="h-[42px] border border-gray-400 bg-white px-3 text-[12px]"><option value="">{t("Tous les statuts")}</option><option value="ACTIVE">{t("Active")}</option><option value="EXPIRED">{t("Expirée")}</option></select>
        </div>
        <ErrorMessage message={error} onClose={() => setError("")}/>
        <div className="overflow-x-auto"><table className="w-full text-left rtl:text-right">
          <thead><tr className="h-11 border-b border-gray-300 bg-gray-50"><Th>{t("N° garantie")}</Th><Th>{t("Date de vente")}</Th><Th>{t("Client")}</Th><Th>{t("Produit")}</Th><Th>{t("Série / lot")}</Th><Th>{t("Fin de garantie")}</Th><Th>{t("Statut")}</Th><Th>{t("Actions")}</Th></tr></thead>
          <tbody>{loading ? <EmptyRow colSpan="8">{t("Chargement des garanties")}</EmptyRow> : !data.items.length ? <EmptyRow colSpan="8">{t("Aucune garantie trouvée")}</EmptyRow> : data.items.map((item) => <tr key={item.id} className="h-12 cursor-pointer border-b border-gray-200 hover:bg-green-50" onClick={() => openDetail(item.id)}>
            <td className="px-5 text-[12px] font-semibold text-[#087c1e]">{item.warranty_number}</td><Td>{formatDate(item.sale_date, language)}</Td><Td>{item.customer_full_name}</Td><Td>{[item.product_nature, item.product_brand, item.product_model].filter(Boolean).join(" · ")}</Td><Td>{item.serial_number || item.batch_number || "—"}</Td><Td>{formatDate(item.warranty_end_date, language)}</Td><Td><BusinessStatusBadge value={item.status}/></Td>
            <td data-warranty-menu className="relative px-4 text-right" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setRowMenu((current) => current === item.id ? null : item.id)} className="inline-flex h-8 w-8 items-center justify-center border border-gray-400 bg-white" aria-label={t("moreActions")}><MoreHorizontal size={17}/></button>{rowMenu === item.id && <div className="absolute right-4 top-10 z-40 min-w-[190px] border border-gray-300 bg-white p-1 text-left shadow-lg rtl:left-4 rtl:right-auto rtl:text-right"><MenuItem icon={Eye} onClick={() => openDetail(item.id)}>{t("Détails")}</MenuItem><MenuItem icon={Printer} onClick={() => openPrint(item.id)}>{t("Réimprimer")}</MenuItem><MenuItem icon={Printer} onClick={() => openPrint(item.id, true)}>{t("Imprimer directement")}</MenuItem><MenuItem icon={FilePenLine} onClick={() => openEdit(item.id)}>{t("Modifier")}</MenuItem></div>}</td>
          </tr>)}</tbody>
        </table></div>
        <Pagination page={data.pagination.page} totalPages={data.pagination.pages} onPageChange={(page) => setFilters((current) => ({ ...current, page }))}/>
      </section>
    </main>
    <WarrantyForm open={!!form} value={form} context={context} onClose={() => setForm(null)} onSave={save} t={t}/>
    <WarrantyDetail warranty={selected} onClose={() => setSelected(null)} onPrint={() => openPrint(selected.id)} t={t} language={language}/>
    <PrintPreview preview={preview} onClose={() => setPreview(null)} onError={setError} t={t}/>
  </div>;
}

function WarrantyForm({ open, value, context, onClose, onSave, t }) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value), [value]);
  if (!draft) return null;
  const patch = (next) => setDraft((current) => ({ ...current, ...next }));
  const product = context.products.find((item) => Number(item.id) === Number(draft.product_id));
  function selectCustomer(id) {
    const customer = context.customers.find((item) => Number(item.id) === Number(id));
    if (!customer) return patch({ customer_id: "" });
    patch({ customer_id: customer.id, customer_full_name: customer.name, customer_phone: customer.phone || "", customer_email: customer.email || "", customer_address: customer.address || "" });
  }
  function selectProduct(id) {
    const item = context.products.find((entry) => Number(entry.id) === Number(id));
    if (!item) return patch({ product_id: "", product_unit_id: "" });
    const documents = draft.source_type === "INVOICE" ? context.invoices : context.sales;
    const document = documents.find((entry) => (entry.invoice_number || entry.sale_number) === draft.source_reference);
    const line = document?.lines?.find((entry) => Number(entry.product_id) === Number(item.id));
    patch({ product_id: item.id, product_unit_id: line?.product_unit_id || item.product_unit_id, product_nature: line?.designation || item.designation, product_model: line?.reference || item.reference || "", invoiced_price: line?.unit_price ?? item.selling_price ?? "", serial_number: line?.serial_numbers?.join(", ") || "", batch_number: line?.batch_numbers?.join(", ") || "" });
  }
  function selectSource(reference) {
    const documents = draft.source_type === "INVOICE" ? context.invoices : context.sales;
    const document = documents.find((item) => (item.invoice_number || item.sale_number) === reference);
    if (!document) return patch({ source_reference: reference });
    const customer = context.customers.find((item) => Number(item.id) === Number(document.customer_id));
    const documentLine = document.lines?.find((line) => Number(line.product_id) === Number(draft.product_id)) || (document.lines?.length === 1 ? document.lines[0] : null);
    const linkedProduct = documentLine && context.products.find((item) => Number(item.id) === Number(documentLine.product_id));
    patch({ source_reference: reference, sale_date: String(document.invoice_date || document.sale_date).slice(0, 10), customer_id: document.customer_id || "", customer_full_name: document.customer_name || customer?.name || draft.customer_full_name, customer_phone: document.customer_phone || customer?.phone || draft.customer_phone, customer_email: document.customer_email || customer?.email || draft.customer_email, customer_address: document.customer_address || customer?.address || draft.customer_address, ...(linkedProduct ? { product_id: linkedProduct.id, product_unit_id: documentLine.product_unit_id || linkedProduct.product_unit_id, product_nature: documentLine.designation || linkedProduct.designation, product_model: documentLine.reference || linkedProduct.reference || "", invoiced_price: documentLine.unit_price, serial_number: documentLine.serial_numbers?.join(", ") || "", batch_number: documentLine.batch_numbers?.join(", ") || "" } : {}) });
  }
  async function submit(event) { event?.preventDefault(); setSaving(true); try { await onSave(draft); } finally { setSaving(false); } }
  return <Modal open={open} title={t(draft.id ? "Modifier la garantie" : "Nouvelle garantie")} onClose={onClose} width="xl" footer={<><Button onClick={onClose}>{t("Annuler")}</Button><Button variant="primary" disabled={saving} onClick={submit}>{t(saving ? "Enregistrement" : "Enregistrer")}</Button></>}>
    <form onSubmit={submit} className="space-y-6 p-5">
      <Section title={t("Informations du client")}><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><FormField label={t("Rechercher et sélectionner un client")}><SearchPicker id="warranty-customers" selectedId={draft.customer_id} items={context.customers} label={(item) => `${item.name}${item.phone ? ` · ${item.phone}` : ""}`} onSelect={selectCustomer} placeholder={t("Saisie manuelle")}/></FormField><Field label={t("Nom complet")} value={draft.customer_full_name} required onChange={(value) => patch({ customer_full_name: value })}/><Field label={t("Téléphone")} value={draft.customer_phone} onChange={(value) => patch({ customer_phone: value })}/><Field label={t("Email")} type="email" value={draft.customer_email} onChange={(value) => patch({ customer_email: value })}/><div className="md:col-span-2"><Field label={t("Adresse")} value={draft.customer_address} onChange={(value) => patch({ customer_address: value })}/></div></div></Section>
      <Section title={t("Produit couvert")}><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><div className="md:col-span-3"><FormField label={t("Rechercher et sélectionner un produit")}><SearchPicker id="warranty-products" selectedId={draft.product_id} items={context.products} label={(item) => `${item.designation} · ${item.reference || ""}`} onSelect={selectProduct} placeholder={t("Saisie manuelle")}/></FormField></div><Field label={t("Nature du produit")} value={draft.product_nature} required onChange={(value) => patch({ product_nature: value })}/><Field label={t("Marque")} value={draft.product_brand} onChange={(value) => patch({ product_brand: value })}/><Field label={t("Modèle")} value={draft.product_model} onChange={(value) => patch({ product_model: value })}/><FormField label={t("Numéro de série")}><input list="warranty-serials" value={draft.serial_number || ""} onChange={(event) => patch({ serial_number: event.target.value })} className={inputClass}/><datalist id="warranty-serials">{(product?.serials || []).map((item) => <option key={item.serial_number} value={item.serial_number}>{item.status}</option>)}</datalist></FormField><FormField label={t("Numéro de lot")}><input list="warranty-batches" value={draft.batch_number || ""} onChange={(event) => patch({ batch_number: event.target.value })} className={inputClass}/><datalist id="warranty-batches">{(product?.batches || []).map((item) => <option key={item.batch_number} value={item.batch_number}>{item.expiration_date || ""}</option>)}</datalist></FormField><Field label={t("Prix facturé")} type="number" min="0" step="0.01" value={draft.invoiced_price} onChange={(value) => patch({ invoiced_price: value })}/></div></Section>
      <Section title={t("Vente et durée de garantie")}><div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"><FormField label={t("Type de référence")} required><select value={draft.source_type || "SALE"} onChange={(event) => patch({ source_type: event.target.value, source_reference: "", product_id: "", product_unit_id: "", serial_number: "", batch_number: "" })} className={inputClass}><option value="SALE">{t("Vente")}</option><option value="INVOICE">{t("Facture")}</option></select></FormField><FormField label={t(draft.source_type === "INVOICE" ? "Référence de facture" : "Référence de vente")}><input list="warranty-sources" value={draft.source_reference || ""} onChange={(event) => selectSource(event.target.value)} className={inputClass}/><datalist id="warranty-sources">{(draft.source_type === "INVOICE" ? context.invoices : context.sales).map((item) => <option key={item.id} value={item.invoice_number || item.sale_number}>{item.customer_name || ""}</option>)}</datalist></FormField><Field label={t("Date de vente")} type="date" value={draft.sale_date} required onChange={(value) => patch({ sale_date: value })}/><Field label={t("Durée")} type="number" min="1" max="12000" value={draft.duration_value} required onChange={(value) => patch({ duration_value: value })}/><FormField label={t("Unité de durée")} required><select value={draft.duration_unit} onChange={(event) => patch({ duration_unit: event.target.value })} className={inputClass}><option value="DAYS">{t("Jours")}</option><option value="MONTHS">{t("Mois")}</option></select></FormField><div className="md:col-span-2 lg:col-span-4"><FormField label={t("Note supplémentaire")}><textarea value={draft.note || ""} onChange={(event) => patch({ note: event.target.value })} rows="3" className="w-full border border-gray-400 bg-white p-3 text-[13px] outline-none"/></FormField></div></div></Section>
    </form>
  </Modal>;
}

function WarrantyDetail({ warranty, onClose, onPrint, t, language }) {
  if (!warranty) return null;
  const sourceType = warranty.source_type || (warranty.invoice_reference ? "INVOICE" : "SALE");
  const sourceReference = warranty.source_reference || warranty.invoice_reference;
  return <Modal open title={`${t("Garantie")} ${warranty.warranty_number}`} onClose={onClose} width="xl" footer={<><Button onClick={onClose}>{t("Fermer")}</Button><Button variant="primary" icon={Printer} onClick={onPrint}>{t("Imprimer")}</Button></>}><div className="space-y-5 p-5"><div className="flex items-center justify-between border border-gray-300 bg-gray-50 p-4"><div><p className="text-[11px] text-black/50">{t("Fin de garantie")}</p><b className="text-[15px]">{formatDate(warranty.warranty_end_date, language)}</b></div><BusinessStatusBadge value={warranty.status}/></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><DetailBox title={t("Client")} rows={[[t("Nom complet"), warranty.customer_full_name], [t("Téléphone"), warranty.customer_phone], [t("Email"), warranty.customer_email], [t("Adresse"), warranty.customer_address]]}/><DetailBox title={t("Vente")} rows={[[t("Type de référence"), t(sourceType === "INVOICE" ? "Facture" : "Vente")], [t(sourceType === "INVOICE" ? "Référence de facture" : "Référence de vente"), sourceReference], [t("Date de vente"), formatDate(warranty.sale_date, language)], [t("Prix facturé"), formatMoney(warranty.invoiced_price, language)], [t("Durée"), `${warranty.duration_value} ${t(warranty.duration_unit === "MONTHS" ? "Mois" : "Jours")}`]]}/></div><DetailBox title={t("Produit couvert")} rows={[[t("Nature du produit"), warranty.product_nature], [t("Marque"), warranty.product_brand], [t("Modèle"), warranty.product_model], [t("Numéro de série"), warranty.serial_number], [t("Numéro de lot"), warranty.batch_number]]}/>{warranty.note && <DetailBox title={t("Note supplémentaire")} rows={[["", warranty.note]]}/>}</div></Modal>;
}
function PrintPreview({ preview, onClose, onError, t }) {
  const [format, setFormat] = useState("A4");
  const [showPreview, setShowPreview] = useState(false);
  useEffect(() => {
    if (!preview) return;
    setFormat(preview.profile?.paper_format || "A4");
    setShowPreview(false);
  }, [preview]);
  const selectedProfile = preview ? { ...preview.profile, paper_format: format } : {};
  const html = useMemo(() => preview ? buildWarrantyPrintHtml(preview.warranty, selectedProfile) : "", [preview, format]);
  if (!preview) return null;
  const print = async (direct = false) => {
    try {
      await window.electronAPI?.printWarranty?.(preview.warranty, direct ? { ...selectedProfile, auto_print: true } : selectedProfile);
      onClose();
    } catch (error) {
      onError(error.message);
    }
  };
  return <Modal open title={`${t("Imprimer")} ${preview.warranty.warranty_number}`} onClose={onClose} width="xl" footer={showPreview ? <><Button onClick={() => setShowPreview(false)}>{t("back")}</Button><Button variant="primary" icon={Printer} onClick={() => print()}>{t("Imprimer")}</Button></> : <><Button onClick={onClose}>{t("Annuler")}</Button><Button onClick={() => print(true)}>{t("Imprimer directement")}</Button><Button variant="primary" onClick={() => setShowPreview(true)}>{t("Prévisualiser")}</Button></>}>
    {!showPreview ? <div className="grid gap-4 p-5 sm:grid-cols-2"><FormField label={t("Document")}><input className={inputClass} value={t("Bon de garantie")} disabled/></FormField><FormField label={t("Format")}><select className={inputClass} value={format} onChange={(event) => setFormat(event.target.value)}><option value="A4">A4</option><option value="A5">A5</option></select></FormField></div> : <div className="h-[65vh] min-h-0"><PrintPreviewCanvas html={html} format={format} title={t("Aperçu impression")}/></div>}
  </Modal>;
}
function Section({ title, children }) { return <section className="border border-gray-300"><h3 className="border-b border-gray-300 bg-gray-50 px-4 py-3 text-[13px] font-bold">{title}</h3><div className="p-4">{children}</div></section>; }
function SearchPicker({ id, selectedId, items, label, onSelect, placeholder }) {
  const selected = items.find((item) => Number(item.id) === Number(selectedId));
  const [query, setQuery] = useState(selected ? label(selected) : "");
  useEffect(() => setQuery(selected ? label(selected) : ""), [selectedId, items]);
  return <><input list={id} value={query} placeholder={placeholder} onChange={(event) => {
    const next = event.target.value;
    setQuery(next);
    const match = items.find((item) => label(item) === next);
    if (match) onSelect(match.id); else if (!next) onSelect("");
  }} className={inputClass}/><datalist id={id}>{items.map((item) => <option key={item.id} value={label(item)}/>)}</datalist></>;
}
function Field({ label, value, onChange, ...props }) { return <FormField label={label} required={props.required}><input {...props} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={inputClass}/></FormField>; }
function DetailBox({ title, rows }) { return <section className="border border-gray-300"><h3 className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-[12px] font-bold">{title}</h3><div className="divide-y divide-gray-100 px-4">{rows.filter(([, value]) => value).map(([label, value], index) => <div key={`${label}:${index}`} className="flex min-h-10 items-center justify-between gap-4 py-2 text-[12px]"><span className="text-black/50">{label}</span><b className="text-right">{value}</b></div>)}</div></section>; }
function MenuItem({ icon: Icon, children, ...props }) { return <button type="button" {...props} className="flex h-9 w-full items-center gap-2 px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"><Icon size={14}/>{children}</button>; }
function Th({ children }) { return <th className="whitespace-nowrap px-5 text-[11px] font-semibold uppercase tracking-wide text-black/60">{children}</th>; }
function Td({ children }) { return <td className="whitespace-nowrap px-5 text-[12px]">{children}</td>; }
function EmptyRow({ colSpan, children }) { return <tr><td colSpan={colSpan} className="h-36 text-center text-[13px] text-black/50"><ShieldCheck size={24} className="mx-auto mb-3"/>{children}</td></tr>; }
