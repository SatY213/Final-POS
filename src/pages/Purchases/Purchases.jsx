import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Plus, RotateCcw } from "lucide-react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ErrorMessage from "../../components/ui/ErrorMessage";
import { inputClass } from "../../components/ui/FormField";
import { formatMoney } from "../../utils/formatters";
import {
  addPurchaseReceiptPayment,
  createSupplierReturn,
  getPurchaseContext,
  getPurchaseReceipts,
  getSupplierReturn,
} from "../../api/purchase.model";
import PurchasePrintDialog, {
  printPurchaseDirect,
} from "./PurchasePrintDialog";
import BusinessStatusBadge from "../../components/ui/BusinessStatusBadge";
import Th from "../../components/ui/Th";
import Td from "../../components/ui/Td";
import ExportButton from "../../components/data-exchange/ExportButton";
import { useLanguage } from "../../i18n/LanguageContext";

const labels = {
  CANCELLED: "Annulé",
  NOT_RETURNED: "Non retourné",
  PARTIALLY_RETURNED: "Partiellement retourné",
  RETURNED: "Retourné",
};
const Status = BusinessStatusBadge;
const MenuAction = ({ children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
  >
    {children}
  </button>
);

export default function Purchases({ warehouseId, onNavigate, initialFilters = null, onReceiptFinalized }) {
  const { t } = useLanguage();
  const [items, setItems] = useState([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  const [context, setContext] = useState({ payment_methods: [] });
  const paymentRequestId = useRef(null);
  const [detail, setDetail] = useState(null),
    [menu, setMenu] = useState(null),
    [returning, setReturning] = useState(null),
    [paymentTarget, setPaymentTarget] = useState(null),
    [payment, setPayment] = useState({ amount: "", payment_method_code: "" }),
    [printTarget, setPrintTarget] = useState(null),
    [saving, setSaving] = useState(false);
  async function reload() {
    if (!warehouseId) return;
    try {
      setError("");
      const [receipts, purchaseContext] = await Promise.all([
        getPurchaseReceipts(warehouseId),
        getPurchaseContext(warehouseId),
      ]);
      setItems(receipts);
      setContext(purchaseContext);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    reload();
  }, [warehouseId]);
  useEffect(() => {
    if (!menu) return;
    const close = (event) => {
      if (!event.target.closest("[data-purchase-row-menu]")) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);
  const rows = useMemo(
    () =>
      items.filter((row) =>
        (!initialFilters?.payment_status || row.payment_status === initialFilters.payment_status) &&
        `${row.receipt_number} ${row.order_number || ""} ${row.supplier_name || ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [items, search, initialFilters],
  );
  const closeMenu = (callback) => {
    setMenu(null);
    callback();
  };
  const startReturn = (row) => {
    const hasReturnableLine = row.lines?.some(
      (line) => Number(line.returnable_quantity) > 0,
    );
    if (!hasReturnableLine) {
      const hasUnreturnedQuantity = row.lines?.some(
        (line) => Number(line.received_returnable_quantity) > 0,
      );
      setMenu(null);
      setError(
        hasUnreturnedQuantity
          ? "No item from this receipt is currently available in stock for return"
          : "All items from this receipt have already been returned",
      );
      return;
    }
    setReturning({
      ...row,
      settlement_mode: "SUPPLIER_CREDIT",
      refund_payment_method_code:
        context.payment_methods.find((method) => method.affects_cash_drawer)
          ?.code || "CASH",
      lines: row.lines.map((line) => ({ ...line, selected_quantity: 0 })),
    });
    setMenu(null);
  };
  const openPayment = (row) => {
    setMenu(null);
    paymentRequestId.current = `purchase-payment:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
    setPaymentTarget(row);
    setPayment({
      amount: String(row.balance_due || ""),
      payment_method_code: context.payment_methods.find((method) => method.code !== "CUSTOMER_CREDIT")?.code || "",
    });
  };
  async function savePayment() {
    try {
      setSaving(true);
      setError("");
      await addPurchaseReceiptPayment(paymentTarget.id, {
        ...payment,
        amount: Number(payment.amount),
        client_request_id: paymentRequestId.current,
      });
      setPaymentTarget(null);
      setDetail(null);
      await reload();
      await onReceiptFinalized?.();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }
  async function directPrint(row) {
    try {
      setMenu(null);
      await printPurchaseDirect(row, "RECEIPT");
    } catch (e) {
      setError(e.message);
    }
  }
  async function saveReturn() {
    try {
      setSaving(true);
      setError("");
      await createSupplierReturn(returning.id, {
        client_request_id: `supplier-return:${globalThis.crypto?.randomUUID?.() || Date.now()}`,
        return_date: new Date().toISOString().slice(0, 10),
        settlement_mode: returning.settlement_mode || "SUPPLIER_CREDIT",
        refund_payment_method_code: returning.refund_payment_method_code,
        lines: returning.lines
          .filter((line) => Number(line.selected_quantity) > 0)
          .map((line) => ({
            purchase_receipt_line_id: line.id,
            quantity: Number(line.selected_quantity),
          })),
      });
      setReturning(null);
      await reload();
      await onReceiptFinalized?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f6f5] p-4 lg:p-5">
      <section className="mx-auto flex h-full w-full max-w-[1550px] min-h-0 flex-col border border-gray-300 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h1 className="text-[18px] font-black">{t("Achats")}</h1>
            <p className="text-[11px] text-black/50">
              {t("Bons de réception et mouvements de stock fournisseurs")}
            </p>
          </div>
          <div className="flex gap-2">
            <ExportButton
              entity="purchase_receipts"
              query={{ warehouse_id: warehouseId, search }}
              onError={setError}
            />
            <Button onClick={() => onNavigate?.("purchase-orders")}>
              {t("purchaseOrders")}
            </Button>
            <Button variant="primary" onClick={() => onNavigate?.("pop")}>
              <Plus size={15} />
              {t("Nouvel achat")}
            </Button>
          </div>
        </header>
        <ErrorMessage message={error} onClose={() => setError("")} />
        <div className="border-b bg-white p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Rechercher un bon de réception, une commande ou un fournisseur…")}
            className="h-10 w-full max-w-xl border border-gray-400 px-3 text-[12px]"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0 z-20">
              <tr className="h-11 border-b border-gray-300 bg-gray-50">
                <Th>{t("N° BR")}</Th>
                <Th>{t("date")}</Th>
                <Th>{t("Commande")}</Th>
                <Th>{t("supplier")}</Th>
                <Th>{t("Paiement")}</Th>
                <Th>{t("back")}</Th>
                <Th right>{t("Total")}</Th>
                <Th right>{t("actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setDetail(row)}
                  className={`h-[50px] cursor-pointer border-b border-gray-200 bg-white transition-colors hover:bg-gray-50 ${menu === row.id ? "relative z-40" : ""}`}
                >
                  <td className="px-5 text-[13px] font-semibold">
                    {row.receipt_number}
                  </td>
                  <Td>{row.receipt_date}</Td>
                  <Td>{row.order_number || t("Sans commande")}</Td>
                  <Td>{row.supplier_name}</Td>
                  <Td><Status value={row.payment_status} /></Td>
                  <Td>
                    <Status value={row.return_status} />
                  </Td>
                  <td className="px-4 text-right text-[12px] font-semibold tabular-nums">
                    {formatMoney(row.total)}
                  </td>
                  <td
                    data-purchase-row-menu
                    className={`relative px-4 text-right ${menu === row.id ? "z-50" : ""}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center border border-gray-400 bg-white"
                      onClick={() => setMenu(menu === row.id ? null : row.id)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                    {menu === row.id && (
                      <div className="absolute right-4 top-10 z-[70] min-w-[180px] border border-gray-300 bg-white p-1 text-left shadow-lg rtl:left-4 rtl:right-auto rtl:text-right">
                        <MenuAction
                          onClick={() => closeMenu(() => setPrintTarget(row))}
                        >
                          {t("reprint")}
                        </MenuAction>
                        <MenuAction onClick={() => directPrint(row)}>
                          {t("Imprimer directement")}
                        </MenuAction>
                        <MenuAction
                          onClick={() =>
                            closeMenu(() =>
                              onNavigate?.("pop", { editReceipt: row }),
                            )
                          }
                        >
                          {t("Modifier")}
                        </MenuAction>
                        <MenuAction
                          onClick={() => closeMenu(() => setDetail(row))}
                        >
                          {t("details")}
                        </MenuAction>
                        <MenuAction onClick={() => startReturn(row)}>
                          {t("createReturn")}
                        </MenuAction>
                        {Number(row.balance_due) > 0 && <MenuAction onClick={() => openPayment(row)}>
                          {t("addPayment")}
                        </MenuAction>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="8" className="p-16 text-center text-black/40">
                    {t("Aucun achat")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex min-h-14 items-center justify-between border-t bg-gray-50 px-5 text-[11px]">
          <span>
            <b>{rows.length}</b> {t("achat(s)")}
          </span>
          <span className="font-semibold">
            {t("Total affiché :")}{" "}
            {formatMoney(
              rows.reduce((sum, row) => sum + Number(row.total || 0), 0),
            )}
          </span>
        </footer>
      </section>
      <Details
        detail={detail}
        onClose={() => setDetail(null)}
        onPay={() => {
          openPayment(detail);
          setDetail(null);
        }}
        onReturn={() => {
          startReturn(detail);
          setDetail(null);
        }}
      />
      <ReturnModal
        receipt={returning}
        setReceipt={setReturning}
        paymentMethods={context.payment_methods}
        onClose={() => setReturning(null)}
        onSave={saveReturn}
        saving={saving}
      />
      <PurchasePrintDialog
        document={printTarget}
        kind="RECEIPT"
        onClose={() => setPrintTarget(null)}
        setError={setError}
      />
      <Modal
        open={!!paymentTarget}
        title={`${t("Ajouter un paiement")} · ${paymentTarget?.receipt_number || ""}`}
        onClose={() => !saving && setPaymentTarget(null)}
        width="sm"
        footer={<>
          <Button onClick={() => setPaymentTarget(null)}>{t("cancel")}</Button>
          <Button variant="primary" disabled={saving || !(Number(payment.amount) > 0) || Number(payment.amount) > Number(paymentTarget?.balance_due || 0)} onClick={savePayment}>{t("validatePayment")}</Button>
        </>}
      >
        <div className="space-y-3 p-5 text-[12px]">
          <div className="flex justify-between border bg-gray-50 p-3"><span>{t("remainingToPay")}</span><b>{formatMoney(paymentTarget?.balance_due || 0)}</b></div>
          <label className="block font-semibold">{t("Montant")}<input autoFocus type="number" min="0.01" max={paymentTarget?.balance_due || 0} step="0.01" className={`${inputClass} mt-1`} value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></label>
          <label className="block font-semibold">{t("Mode")}<select className={`${inputClass} mt-1`} value={payment.payment_method_code} onChange={(event) => setPayment({ ...payment, payment_method_code: event.target.value })}>{context.payment_methods.filter((method) => method.code !== "CUSTOMER_CREDIT").map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</select></label>
        </div>
      </Modal>
    </div>
  );
}

function Details({ detail, onClose, onReturn, onPay }) {
  const { t } = useLanguage();
  const [returnDetail, setReturnDetail] = useState(null),
    [detailError, setDetailError] = useState("");
  if (!detail) return null;
  return (
    <Modal
      open
      title={`${t("Bon de réception")} ${detail.receipt_number}`}
      onClose={onClose}
      width="xl"
      footer={
        <>
          <Button onClick={onClose}>{t("close")}</Button>
          <Button variant="primary" onClick={onReturn}>
            {t("createReturn")}
          </Button>
          {Number(detail.balance_due) > 0 && <Button variant="primary" onClick={onPay}>{t("addPayment")}</Button>}
        </>
      }
    >
      <div className="p-5 text-[12px] text-gray-900">
        <ErrorMessage
          message={detailError}
          onClose={() => setDetailError("")}
        />
        <h3 className="mb-2 text-[12px] font-black uppercase tracking-wide">
          {t("Informations")}
        </h3>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label={t("date")} value={detail.receipt_date} />
          <Info label={t("supplier")} value={detail.supplier_name} />
          <Info label={t("warehouse")} value={detail.warehouse_name} />
          <Info
            label={t("Commande")}
            value={detail.order_number || "Sans commande"}
          />
          <Info label={t("Document")} value={detail.receipt_number} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatusCard
            label={t("Paiement")}
            value={detail.payment_status}
            detail={
              Number(detail.balance_due || 0) > 0
                ? `Reste ${formatMoney(detail.balance_due)}`
                : null
            }
          />
          <StatusCard label={t("back")} value={detail.return_status} />
        </div>
        <h3 className="mb-2 mt-5 text-[12px] font-black uppercase tracking-wide">
          {t("items")}
        </h3>
        <Lines lines={detail.lines} />
        <div className="ms-auto mt-4 w-full max-w-[330px] border border-gray-200 bg-gray-50 p-4">
          <Summary label={t("Total reçu")} value={detail.total} />
          {detail.return_summary?.return_total > 0 && (
            <>
              <Summary
                label={t("returns")}
                value={-detail.return_summary.return_total}
              />
              <Summary
                label={t("Net après retours")}
                value={detail.return_summary.net_purchase_amount}
                strong
              />
            </>
          )}
        </div>
        <h3 className="mb-2 mt-6 text-[12px] font-black uppercase tracking-wide">
          {t("Paiement")}
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <FinancialValue
            label={t("paid")}
            value={detail.payment_summary?.paid_total || 0}
          />
          <FinancialValue
            label={t("remainingToPay")}
            value={detail.payment_summary?.balance_due || 0}
          />
          <div className="flex items-center justify-between border border-gray-300 bg-gray-50 px-4 py-3 text-[13px]">
            <span>{t("status")}</span>
            <Status value={
              detail.payment_summary?.payment_status || detail.payment_status
            } />
          </div>
        </div>
        {Number(detail.payment_summary?.supplier_credit || 0) > 0 && (
          <div className="mt-2 flex items-center justify-between border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-900">
            <span>{t("Crédit fournisseur disponible")}</span>
            <b>{formatMoney(detail.payment_summary.supplier_credit)}</b>
          </div>
        )}
        {detail.returns?.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-2 text-[12px] font-black uppercase tracking-wide">
              {t("returns")}
            </h3>
            <div className="border border-gray-200">
              {detail.returns.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 last:border-b-0"
                >
                  <div>
                    <b className="block text-gray-950">{item.return_number}</b>
                    <span className="text-[10px] text-gray-500">
                      {item.return_date}
                    </span>
                  </div>
                  <b>{formatMoney(item.total)}</b>
                  <Button
                    onClick={async () => {
                      try {
                        setReturnDetail(await getSupplierReturn(item.id));
                      } catch (error) {
                        setDetailError(error.message);
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
                  {formatMoney(detail.return_summary?.return_total || 0)}
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
          footer={<Button onClick={() => setReturnDetail(null)}>{t("close")}</Button>}
        >
          <div className="p-5">
            <Lines lines={returnDetail?.lines || []} />
            <div className="ms-auto mt-4 w-full max-w-[300px] border bg-gray-50 p-4">
              <Summary
                label={t("Total retourné")}
                value={returnDetail?.total || 0}
                strong
              />
            </div>
          </div>
        </Modal>
      </div>
    </Modal>
  );
}
const StatusCard = ({ label, value, detail }) => (
  <div className="border border-gray-200 bg-white p-3">
    <div className="mb-2 text-[10px] font-bold uppercase text-gray-500">
      {label}
    </div>
    <Status value={value} />
    {detail && (
      <div className="mt-2 text-[11px] font-medium text-gray-600">
        {detail}
      </div>
    )}
  </div>
);
const FinancialValue = ({ label, value }) => (
  <div className="flex items-center justify-between border border-gray-300 bg-gray-50 px-4 py-3 text-[13px]">
    <span>{label}</span>
    <b>{formatMoney(value)}</b>
  </div>
);
const Summary = ({ label, value, strong }) => (
  <div
    className={`flex items-center justify-between py-1.5 ${strong ? "border-t border-gray-300 pt-2 font-bold" : ""}`}
  >
    <span>{label}</span>
    <b>{formatMoney(value)}</b>
  </div>
);
export function ReturnModal({
  receipt,
  setReceipt,
  paymentMethods,
  onClose,
  onSave,
  saving,
  partyType = "supplier",
}) {
  const { t } = useLanguage();
  if (!receipt) return null;
  const isCustomer = partyType === "customer";
  const creditMode = isCustomer ? "CUSTOMER_CREDIT" : "SUPPLIER_CREDIT";
  const cashMethod = (paymentMethods || []).find(
    (method) => method.affects_cash_drawer,
  );
  const patch = (index, value) =>
    setReceipt({
      ...receipt,
      lines: receipt.lines.map((line, current) =>
        current === index
          ? typeof value === "object"
            ? { ...line, ...value }
            : { ...line, selected_quantity: value }
          : line,
      ),
    });
  const total = receipt.lines.reduce(
    (sum, line) =>
      sum + Number(line.selected_quantity || 0) * Number(line.return_unit_total ?? line.unit_price ?? 0),
    0,
  );
  return (
    <Modal
      open
      title={`Retour ${receipt.receipt_number || receipt.sale_number}`}
      onClose={onClose}
      width="xl"
      footer={
        <>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button
            variant="primary"
            disabled={
              saving ||
              !receipt.lines.some((line) => Number(line.selected_quantity) > 0)
            }
            onClick={onSave}
          >
            <RotateCcw size={15} />
            {t("Valider le retour")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <div className="border bg-gray-50 p-3 text-[12px]">
          {isCustomer
            ? t("Le retour remet les articles en stock et corrige le solde du client. Les paiements déjà enregistrés restent inchangés.")
            : t("Le retour réduit le stock et le solde dû au fournisseur. Les paiements déjà enregistrés restent inchangés; tout excédent devient un crédit fournisseur.")}
        </div>
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            {t("Règlement du retour")}
          </p>
          <select
            value={receipt.settlement_mode || creditMode}
            onChange={(event) => {
              const settlementMode = event.target.value;
              setReceipt({
                ...receipt,
                settlement_mode: settlementMode,
                refund_payment_method_code:
                  settlementMode === "REFUND"
                    ? cashMethod?.code || receipt.refund_payment_method_code || "CASH"
                    : receipt.refund_payment_method_code,
              });
            }}
            className={inputClass}
          >
            <option value={creditMode}>
              {isCustomer
                ? t("Créer un avoir / crédit client")
                : t("Créer un avoir / crédit fournisseur")}
            </option>
            <option value="REFUND">
              {isCustomer
                ? t("Rembourser le client en espèces")
                : t("Remboursement fournisseur en espèces")}
            </option>
          </select>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-3 text-left">{t("Article")}</th>
              <th>{t("received")}</th>
              <th>{t("Retournable")}</th>
              <th className="p-3">{t("Quantité à retourner")}</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line, index) => (
              <tr key={line.id} className="border-b">
                <td className="p-3 font-semibold">
                  {line.designation}
                  {isCustomer && Boolean(line.track_serials) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 font-normal">
                      {(line.returnable_serials || []).map((serial) => {
                        return (
                          <span
                            key={serial.id}
                            className="border border-gray-300 bg-gray-50 px-2 py-1 text-[10px] font-semibold"
                          >
                            {t("N° série :")} {serial.serial_number}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {isCustomer && Boolean(line.track_batches) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 font-normal">
                      {(line.batch_allocations || [])
                        .filter((batch) => Number(batch.returnable_quantity) > 0)
                        .map((batch) => (
                        <span
                          key={batch.batch_id}
                          className="border border-gray-300 bg-gray-50 px-2 py-1 text-[10px] font-semibold"
                        >
                          {t("Lot :")} {batch.batch_number}
                          {batch.expiration_date
                            ? ` · ${batch.expiration_date}`
                            : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>{line.quantity}</td>
                <td>
                  {line.returnable_quantity}
                  {Number(line.received_returnable_quantity) >
                    Number(line.returnable_quantity) && (
                    <span className="ml-1 text-[10px] text-amber-700">
                      {t("(stock disponible)")}
                    </span>
                  )}
                </td>
                <td className="p-2">
                  <input
                    className="h-8 w-28 border border-gray-400 px-2"
                    type="number"
                    min="0"
                    max={line.returnable_quantity}
                    value={line.selected_quantity}
                    onChange={(e) =>
                      patch(
                        index,
                        Math.min(
                          Number(line.returnable_quantity),
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto w-72 border px-4 py-3 text-right text-[12px]">
          {t("Montant du retour :")} <b>{formatMoney(total)}</b>
        </div>
      </div>
    </Modal>
  );
}
function Lines({ lines = [] }) {
  const { t } = useLanguage();
  return (
    <div className="overflow-auto border">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="h-10 border-b bg-gray-50">
            <th className="px-4">{t("designation")}</th>
            <th className="text-right">{t("quantity")}</th>
            <th className="text-right">{t("Prix unitaire")}</th>
            <th className="px-4 text-right">{t("Total")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="h-11 border-b">
              <td className="px-4 font-semibold">{line.designation}</td>
              <td className="text-right">{line.quantity}</td>
              <td className="text-right">{formatMoney(line.unit_price)}</td>
              <td className="px-4 text-right font-bold">
                {formatMoney(line.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] font-bold uppercase text-black/45">{label}</div>
    <div className="mt-1 font-semibold">{value || "—"}</div>
  </div>
);
