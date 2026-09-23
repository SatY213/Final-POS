import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Button from "../../components/ui/Button";
import ErrorMessage from "../../components/ui/ErrorMessage";
import Modal from "../../components/ui/Modal";
import { inputClass } from "../../components/ui/FormField";
import { ArticleEditor, DiscountDialog } from "../PointOfSale/PosDialogs";
import {
  addInvoicePayment,
  createInvoice,
  getEligibleInvoiceSales,
  getInvoice,
  getInvoiceContext,
  updateInvoice,
} from "../../api/sales.model";
import { formatMoney } from "../../utils/formatters";
import { useLanguage } from "../../i18n/LanguageContext";
import { getCustomers } from "../../api/customer.model";

const dateValue = () => new Date().toISOString().slice(0, 10),
  round = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full ${checked ? "bg-[#159447]" : "bg-gray-300"}`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`}
      />
    </button>
  );
}

export default function InvoiceBuilder({
  warehouseId,
  initialSaleId,
  invoiceId,
  openPayment,
  onNavigate,
}) {
  const invoiceLoaded = useRef(false);
  const creationRequestId = useRef(`invoice:${globalThis.crypto?.randomUUID?.() || Date.now()}`);
  const paymentRequestId = useRef(`invoice-payment:${globalThis.crypto?.randomUUID?.() || Date.now()}`);
  const { t, language } = useLanguage();
  const [context, setContext] = useState(null),
    [sales, setSales] = useState([]),
    [customers, setCustomers] = useState([]),
    [selected, setSelected] = useState([]),
    [lines, setLines] = useState([]),
    [sourceLines, setSourceLines] = useState([]);
  const [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(dateValue()),
    [customerId, setCustomerId] = useState("");
  const [form, setForm] = useState({
    invoice_number: "",
    invoice_date: dateValue(),
    discount_type: "PERCENT",
    discount_value: 0,
    tax_enabled: true,
    tax_rate: 19,
    stamp_enabled: true,
    stamp_rate: 1,
    note: "",
  });
  const [editor, setEditor] = useState(null),
    [discountOpen, setDiscountOpen] = useState(false),
    [addLineOpen, setAddLineOpen] = useState(false),
    [paymentOpen, setPaymentOpen] = useState(false),
    [payment, setPayment] = useState({
      amount: "",
      payment_method_code: "",
      reference: "",
    }),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [created, setCreated] = useState(null),
    [editingInvoice, setEditingInvoice] = useState(null);
  async function load() {
    if (!warehouseId) return;
    try {
      setError("");
      const [ctx, rows, customerResult, invoice] = await Promise.all([
        getInvoiceContext(warehouseId),
        getEligibleInvoiceSales({
          warehouse_id: warehouseId,
          search,
          from,
          to,
          customer_id: customerId,
        }),
        getCustomers({ limit: 200, status: "active" }),
        invoiceId && !invoiceLoaded.current ? getInvoice(invoiceId) : null,
      ]);
      setContext(ctx);
      setCustomers(customerResult.items || customerResult.customers || []);
      if (invoice) {
        invoiceLoaded.current = true;
        setEditingInvoice(invoice);
        const linkedSales = invoice.sales.map((sale) => ({
          ...sale,
          linked_invoice: true,
          customer_id: invoice.customer_id,
          customer_name: invoice.customer_name,
          paid_amount: sale.direct_paid_amount,
          lines: invoice.source_lines.filter(
            (line) => Number(line.sale_id) === Number(sale.id),
          ),
        }));
        setSales([
          ...linkedSales,
          ...rows.filter(
            (row) =>
              !linkedSales.some((sale) => Number(sale.id) === Number(row.id)),
          ),
        ]);
        setSelected(invoice.sales.map((sale) => sale.id));
        setLines(
          invoice.lines.map((line) => ({ ...line, track_stock: false })),
        );
        setSourceLines(invoice.source_lines);
        setCustomerId(
          invoice.customer_id == null ? "" : String(invoice.customer_id),
        );
        setForm({
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          discount_type: invoice.discount_type,
          discount_value: invoice.discount_value,
          tax_enabled: !!invoice.tax_enabled,
          tax_rate: invoice.tax_rate,
          stamp_enabled: !!invoice.stamp_enabled,
          stamp_rate: invoice.stamp_rate,
          note: invoice.note || "",
        });
        if (openPayment && invoice.balance_due > 0) {
          setPayment((current) => ({
            ...current,
            amount: invoice.balance_due,
          }));
          setPaymentOpen(true);
        }
      } else {
        setSales((current) =>
          invoiceId && invoiceLoaded.current
            ? [
                ...current.filter((sale) => sale.linked_invoice),
                ...rows.filter(
                  (row) =>
                    !current.some(
                      (sale) =>
                        sale.linked_invoice &&
                        Number(sale.id) === Number(row.id),
                    ),
                ),
              ]
            : rows,
        );
      }
      setForm((f) => ({
        ...f,
        invoice_number: f.invoice_number || ctx.next_invoice_number,
        tax_enabled: f.invoice_number
          ? f.tax_enabled
          : ctx.settings.tax_enabled,
        tax_rate: f.invoice_number ? f.tax_rate : ctx.settings.tax_rate,
        stamp_enabled: f.invoice_number
          ? f.stamp_enabled
          : ctx.settings.stamp_enabled,
        stamp_rate: f.invoice_number ? f.stamp_rate : ctx.settings.stamp_rate,
      }));
      setPayment((p) => ({
        ...p,
        payment_method_code:
          p.payment_method_code || ctx.payment_methods[0]?.code || "",
      }));
      if (!invoiceId && initialSaleId && !selected.length) {
        const target = rows.find((r) => Number(r.id) === Number(initialSaleId));
        if (target) selectSale(target);
      }
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [warehouseId, search, from, to, customerId]);
  function selectSale(sale) {
    const exists = selected.some((id) => Number(id) === Number(sale.id));
    if (invoiceId && exists && sale.linked_invoice) return;
    if (!exists && selected.length) {
      const first = sales.find((s) => Number(s.id) === Number(selected[0]));
      if (Number(first?.customer_id || 0) !== Number(sale.customer_id || 0)) {
        setError(
          "Toutes les ventes d'une facture doivent appartenir au même client.",
        );
        return;
      }
    }
    if (exists) {
      setSelected((ids) => ids.filter((id) => Number(id) !== Number(sale.id)));
      setLines((rows) =>
        rows.filter((l) => Number(l.sale_id) !== Number(sale.id)),
      );
    } else {
      setSelected((ids) => [...ids, sale.id]);
      setCustomerId(String(sale.customer_id || ""));
      setLines((rows) => [
        ...rows,
        ...sale.lines.map((l) => ({
          ...l,
          sale_number: sale.sale_number,
          sale_line_id: l.id,
          track_stock: false,
        })),
      ]);
      setSourceLines((rows) => [
        ...rows,
        ...sale.lines
          .filter(
            (line) =>
              !rows.some((source) => Number(source.id) === Number(line.id)),
          )
          .map((line) => ({ ...line, sale_number: sale.sale_number })),
      ]);
    }
  }
  const selectedSales = useMemo(
    () =>
      sales.filter((s) => selected.some((id) => Number(id) === Number(s.id))),
    [sales, selected],
  );
  const availableSourceLines = useMemo(
    () =>
      sourceLines.filter(
        (source) =>
          !lines.some(
            (line) =>
              Number(line.sale_line_id || line.id) === Number(source.id),
          ),
      ),
    [sourceLines, lines],
  );
  const lineGross = round(
    lines.reduce((sum, l) => {
      const sub = Number(l.quantity) * Number(l.unit_price),
        d =
          l.discount_type === "FIXED"
            ? Number(l.discount_value || 0)
            : (sub * Number(l.discount_value || 0)) / 100;
      return sum + Math.max(0, sub - d);
    }, 0),
  );
  const globalDiscount = round(
      form.discount_type === "FIXED"
        ? Math.min(Number(form.discount_value || 0), lineGross)
        : (lineGross * Number(form.discount_value || 0)) / 100,
    ),
    ht = round(lineGross - globalDiscount),
    tax = round(form.tax_enabled ? (ht * Number(form.tax_rate || 0)) / 100 : 0),
    stamp = round(
      form.stamp_enabled ? (ht * Number(form.stamp_rate || 0)) / 100 : 0,
    ),
    total = round(ht + tax + stamp),
    alreadyPaid = editingInvoice
      ? Number(editingInvoice.paid_amount)
      : round(
          selectedSales.reduce((s, x) => s + Number(x.paid_amount || 0), 0),
        ),
    balance = Math.max(0, round(total - alreadyPaid)),
    overpaid = Math.max(0, round(alreadyPaid - total));
  async function submit(paymentOverride = null) {
    if (!selected.length || !lines.length)
      return setError("Sélectionnez au moins une vente et un article.");
    try {
      setSaving(true);
      setError("");
      const payload = {
        ...form,
        customer_id: customerId || null,
        sale_ids: selected,
        lines: lines.map((l) => ({
          sale_line_id: l.sale_line_id,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          discount_type: l.discount_type,
          discount_value: Number(l.discount_value || 0),
        })),
      };
      let invoice = invoiceId
        ? await updateInvoice(invoiceId, payload)
        : await createInvoice({
            ...payload,
            client_request_id: creationRequestId.current,
          });
      const paymentToSave = paymentOverride || payment;
      if (Number(paymentToSave.amount) > 0)
        invoice = await addInvoicePayment(invoice.id, {
          ...paymentToSave,
          amount: Number(paymentToSave.amount),
          client_request_id: paymentRequestId.current,
        });
      setEditingInvoice(invoice);
      setCreated(invoice);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  if (created)
    return (
      <div className="flex h-full items-center justify-center bg-[#f5f7f5] p-8">
        <div className="w-full max-w-xl border border-green-300 bg-white p-8 text-center shadow-xl">
          <Check className="mx-auto text-green-600" size={50} />
          <h1 className="mt-4 text-2xl font-black">
            {invoiceId ? t("Facture modifiée") : t("Facture créée")}
          </h1>
          <p className="mt-2 text-black/60">{created.invoice_number}</p>
          <p className="mt-5 text-3xl font-black text-green-700">
            {formatMoney(created.total, language)}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button onClick={() => onNavigate("sales")}>
              {t("Retour aux ventes")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setCreated(null);
                setSelected([]);
                setLines([]);
                creationRequestId.current = `invoice:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
                paymentRequestId.current = `invoice-payment:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
                setForm((f) => ({ ...f, invoice_number: "" }));
                load();
              }}
            >
              {t("Nouvelle facture")}
            </Button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f5f7f5] text-[#111827]">
      <ErrorMessage message={error} onClose={() => setError("")} />
      <div className="min-h-0 flex-1 overflow-auto p-5 pb-28">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <main className="space-y-3">
            <section className="border border-gray-200 bg-white">
              <div className="flex border-b">
                <button className="border-b-2 border-green-600 bg-green-50 px-7 py-3 text-xs font-bold text-green-700">
                  {t("Sélectionner des ventes")}
                </button>
                <span className="px-7 py-3 text-xs font-semibold text-black/45">
                  {t("Saisie manuelle")}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_160px_160px] gap-3 p-3">
                <label className="relative">
                  <Search
                    className="absolute left-3 top-3 text-black/45"
                    size={17}
                  />
                  <input
                    className={`${inputClass} pl-10`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("Rechercher un n° vente ou un client...")}
                  />
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <input
                  type="date"
                  className={inputClass}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="max-h-[245px] overflow-auto border-t">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      {[
                        "",
                        "N° vente",
                        "Date",
                        "Client",
                        "Total",
                        "Payé",
                        "Reste",
                      ].map((x) => (
                        <th className="px-3 py-3">{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => selectSale(s)}
                        className={`cursor-pointer border-t ${selected.includes(s.id) ? "bg-green-50" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-3">
                          <span
                            className={`flex h-5 w-5 items-center justify-center border ${selected.includes(s.id) ? "border-green-600 bg-green-600 text-white" : "border-gray-400"}`}
                          >
                            {selected.includes(s.id) && <Check size={14} />}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold">{s.sale_number}</td>
                        <td>{s.sale_date}</td>
                        <td>{s.customer_name || t("Client comptoir")}</td>
                        <td>{formatMoney(s.total, language)}</td>
                        <td>{formatMoney(s.paid_amount, language)}</td>
                        <td>
                          {formatMoney(
                            Number(s.total) - Number(s.paid_amount),
                            language,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between border-t p-3 text-xs">
                <b>{selected.length} {t("vente(s) sélectionnée(s)")}</b>
                <span>
                  {t("Déjà payé :")} <b>{formatMoney(alreadyPaid, language)}</b>
                </span>
              </div>
            </section>
            <section className="border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b p-3">
                <h2 className="font-bold">{t("Articles de la facture")}</h2>
                <div className="flex gap-2">
                  <Button
                    icon={Plus}
                    onClick={() => setAddLineOpen(true)}
                    disabled={!availableSourceLines.length}
                  >
                    {t("Ajouter un article")}
                  </Button>
                  <Button onClick={() => setDiscountOpen(true)}>
                    {t("% Remise globale")}
                  </Button>
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={() => setLines([])}
                  >
                    {t("Vider la liste")}
                  </Button>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "#",
                        t("Désignation"),
                        "Vente",
                        t("Quantité"),
                        "Unité",
                        t("Prix unitaire"),
                        "Remise",
                        "Total",
                        "",
                      ].map((x) => (
                        <th className="px-3 py-3">{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const sub = Number(l.quantity) * Number(l.unit_price),
                        disc =
                          l.discount_type === "FIXED"
                            ? Number(l.discount_value || 0)
                            : (sub * Number(l.discount_value || 0)) / 100;
                      return (
                        <tr key={l.sale_line_id} className="border-t">
                          <td className="px-3 py-3">{i + 1}</td>
                          <td className="font-semibold">{l.designation}</td>
                          <td>{l.sale_number}</td>
                          <td>{l.quantity}</td>
                          <td>{l.unit_name}</td>
                          <td>{formatMoney(l.unit_price, language)}</td>
                          <td>
                            {l.discount_value || 0}
                            {l.discount_type === "PERCENT" ? "%" : " DA"}
                          </td>
                          <td className="font-bold">
                            {formatMoney(Math.max(0, sub - disc), language)}
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <button
                                className="border p-2"
                                onClick={() => setEditor(l)}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                className="border border-red-300 p-2 text-red-600"
                                onClick={() =>
                                  setLines((r) =>
                                    r.filter(
                                      (x) => x.sale_line_id !== l.sale_line_id,
                                    ),
                                  )
                                }
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
          <aside className="h-fit border border-gray-200 bg-white p-4">
            <h2 className="mb-5 text-base font-black">
              {t("Informations de la facture")}
            </h2>
            <label className="mb-3 block text-xs font-semibold">
              {t("N° facture *")}
              <input
                className={`${inputClass} mt-1 bg-green-50 font-bold`}
                value={form.invoice_number}
                onChange={(e) =>
                  setForm({ ...form, invoice_number: e.target.value })
                }
              />
            </label>
            <label className="mb-3 block text-xs font-semibold">
              {t("Date facture *")}
              <input
                type="date"
                className={`${inputClass} mt-1`}
                value={form.invoice_date}
                onChange={(e) =>
                  setForm({ ...form, invoice_date: e.target.value })
                }
              />
            </label>
            <label className="mb-4 block text-xs font-semibold">
              {t("Client *")}
              <select
                className={`${inputClass} mt-1`}
                value={customerId}
                onChange={(e) => {
                  setSelected([]);
                  setLines([]);
                  setCustomerId(e.target.value);
                }}
              >
                <option value="">{t("allCustomers")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="border-t pt-4">
              <h3 className="mb-4 text-sm font-black">{t("Paramètres fiscaux")}</h3>
              <div className="mb-4 flex items-center justify-between text-xs">
                <span>{t("Utiliser la TVA")}</span>
                <Toggle
                  checked={form.tax_enabled}
                  onChange={(v) => setForm({ ...form, tax_enabled: v })}
                />
              </div>
              <label className="mb-4 block text-xs">
                {t("Taux TVA")}
                <input
                  disabled={!form.tax_enabled}
                  type="number"
                  className={`${inputClass} mt-1`}
                  value={form.tax_rate}
                  onChange={(e) =>
                    setForm({ ...form, tax_rate: e.target.value })
                  }
                />
              </label>
              <div className="mb-4 flex items-center justify-between text-xs">
                <span>{t("Utiliser le timbre fiscal")}</span>
                <Toggle
                  checked={form.stamp_enabled}
                  onChange={(v) => setForm({ ...form, stamp_enabled: v })}
                />
              </div>
              <label className="block text-xs">
                {t("Taux du timbre fiscal (%)")}
                <input
                  disabled={!form.stamp_enabled}
                  type="number"
                  className={`${inputClass} mt-1`}
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.stamp_rate}
                  onChange={(e) =>
                    setForm({ ...form, stamp_rate: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="mt-5 block border-t pt-4 text-xs font-semibold">
              {t("Notes")}
              <textarea
                rows="4"
                className="mt-2 min-h-[104px] w-full resize-y border border-gray-400 bg-white px-3 py-2 text-[12px] leading-5 outline-none focus:border-gray-700"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder={t("Notes sur la facture...")}
              />
            </label>
          </aside>
        </div>
      </div>
      <footer className="fixed bottom-0 left-0 right-0 z-20 flex h-[92px] items-center justify-between border-t bg-white px-6 shadow-[0_-4px_16px_rgba(0,0,0,.06)]">
        <Button onClick={() => onNavigate("sales")} icon={X}>
          {t("cancel")}
        </Button>
        <div className="flex items-center gap-7 text-xs">
          <span>
            {t("Total HT")}
            <br />
            <b className="text-lg">{formatMoney(ht, language)}</b>
          </span>
          <span>
            {t("TVA (")}{form.tax_rate}%)
            <br />
            <b className="text-lg">{formatMoney(tax, language)}</b>
          </span>
          <span>
            {t("Timbre fiscal (")}{form.stamp_rate}%)
            <br />
            <b className="text-lg">{formatMoney(stamp, language)}</b>
          </span>
          <span>
            {t("Déjà payé")}
            <br />
            <b className="text-lg">{formatMoney(alreadyPaid, language)}</b>
          </span>
          {overpaid > 0 && (
            <span className="bg-blue-50 px-4 py-3 text-blue-800">
              {t("Trop-perçu / crédit")}
              <br />
              <b className="text-lg">{formatMoney(overpaid, language)}</b>
            </span>
          )}
          <Button
            icon={Plus}
            disabled={!balance}
            onClick={() => {
              setPayment((p) => ({ ...p, amount: balance }));
              setPaymentOpen(true);
            }}
          >
            {t("addPayment")}
          </Button>
          <span className="bg-green-50 px-5 py-3 text-green-800">
            {t("remainingToPay")}
            <br />
            <b className="text-2xl">
              {formatMoney(
                Math.max(0, balance - Number(payment.amount || 0)),
                language,
              )}
            </b>
          </span>
          <Button
            variant="primary"
            icon={FileText}
            disabled={saving || !lines.length}
            onClick={() => submit(invoiceId ? { amount: 0 } : null)}
          >
            {saving
              ? invoiceId
                ? "Enregistrement..."
                : t("Création...")
              : invoiceId
                ? t("Enregistrer les modifications")
                : t("Créer la facture")}
          </Button>
        </div>
      </footer>
      <ArticleEditor
        open={!!editor}
        line={editor}
        units={[]}
        settings={{ allow_price_edit: true, allow_discount: true }}
        showStock={false}
        language={language}
        t={t}
        onClose={() => setEditor(null)}
        onConfirm={(updated) => {
          setLines((rows) =>
            rows.map((l) =>
              l.sale_line_id === editor.sale_line_id ? { ...l, ...updated } : l,
            ),
          );
          setEditor(null);
        }}
      />
      <DiscountDialog
        open={discountOpen}
        title={t("globalDiscount")}
        discount={{ type: form.discount_type, value: form.discount_value }}
        maximum={100}
        t={t}
        onClose={() => setDiscountOpen(false)}
        onConfirm={(d) => {
          setForm({ ...form, discount_type: d.type, discount_value: d.value });
          setDiscountOpen(false);
        }}
      />
      <Modal
        open={addLineOpen}
        title={t("Ajouter un article de vente")}
        onClose={() => setAddLineOpen(false)}
        width="lg"
        footer={<Button onClick={() => setAddLineOpen(false)}>{t("close")}</Button>}
      >
        <div className="max-h-[55vh] overflow-auto p-5">
          {!availableSourceLines.length ? (
            <p className="text-[12px] text-black/55">
              {t("Tous les articles des ventes liées sont déjà présents.")}
            </p>
          ) : (
            availableSourceLines.map((line) => (
              <button
                key={line.id}
                type="button"
                onClick={() => {
                  setLines((rows) => [
                    ...rows,
                    { ...line, sale_line_id: line.id, track_stock: false },
                  ]);
                  setAddLineOpen(false);
                }}
                className="flex w-full items-center justify-between border-b border-gray-200 px-3 py-3 text-left hover:bg-green-50"
              >
                <span>
                  <b>{line.designation}</b>
                  <small className="ml-2 text-black/50">
                    {line.sale_number}
                  </small>
                </span>
                <span>
                  {line.quantity} {line.unit_name} ·{" "}
                  {formatMoney(line.unit_price, language)}
                </span>
              </button>
            ))
          )}
        </div>
      </Modal>
      <Modal
        open={paymentOpen}
        title={t("addPayment")}
        onClose={() => setPaymentOpen(false)}
        width="sm"
        footer={
          <>
            <Button
              onClick={() => {
                setPaymentOpen(false);
                setPayment((current) => ({
                  ...current,
                  amount: "",
                  reference: "",
                }));
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={
                saving ||
                !(Number(payment.amount) > 0) ||
                Number(payment.amount) > balance
              }
              onClick={async () => {
                if (await submit(payment)) setPaymentOpen(false);
              }}
            >
              {t("Valider")}
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-5">
          <label className="block text-xs font-semibold">
            {t("Montant")}
            <input
              type="number"
              min="0"
              max={balance}
              className={`${inputClass} mt-1`}
              value={payment.amount}
              onChange={(e) =>
                setPayment({ ...payment, amount: e.target.value })
              }
            />
          </label>
          <label className="block text-xs font-semibold">
            {t("Mode")}
            <select
              className={`${inputClass} mt-1`}
              value={payment.payment_method_code}
              onChange={(e) =>
                setPayment({ ...payment, payment_method_code: e.target.value })
              }
            >
              {context?.payment_methods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold">
            {t("reference")}
            <input
              className={`${inputClass} mt-1`}
              value={payment.reference}
              onChange={(e) =>
                setPayment({ ...payment, reference: e.target.value })
              }
            />
          </label>
          <p className="text-[11px] text-amber-700">
            {invoiceId
              ? t("Le paiement sera enregistré immédiatement après validation.")
              : t("Le paiement sera encaissé uniquement lors de la création de la facture.")}
          </p>
        </div>
      </Modal>
    </div>
  );
}
