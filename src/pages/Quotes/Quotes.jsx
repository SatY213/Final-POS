import { useEffect, useState } from "react";
import { FileText, MoreHorizontal } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import ErrorMessage from "../../components/ui/ErrorMessage";
import StatusBadge from "../../components/ui/StatusBadge";
import Th from "../../components/ui/Th";
import Td from "../../components/ui/Td";
import QuotePrintDialog from "./QuotePrintDialog";
import Pagination from "../../components/ui/Pagination";
import DocumentFilters from "../../components/ui/DocumentFilters";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { formatDate, formatMoney } from "../../utils/formatters";
import {
  getQuote,
  getQuotes,
  updateQuoteStatus,
} from "../../api/commercial.model";
import { useLanguage } from "../../i18n/LanguageContext";
import { getRuntimeSettings } from "../../utils/runtimeSettings";
import ExportButton from "../../components/data-exchange/ExportButton";

export default function Quotes({ warehouseId, onNavigate }) {
  const { language, t } = useLanguage();
  const empty = () => ({
    search: "",
    from: "",
    to: "",
    status: "",
    page: 1,
    limit: Number(getRuntimeSettings().default_page_size || 25),
  });
  const [filters, setFilters] = useState(empty),
    search = useDebouncedValue(filters.search);
  const [data, setData] = useState({
    items: [],
    pagination: { page: 1, pages: 1, total: 0 },
  });
  const [detail, setDetail] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [error, setError] = useState("");
  async function load() {
    if (warehouseId)
      try {
        setData(
          await getQuotes({ warehouse_id: warehouseId, ...filters, search }),
        );
      } catch (e) {
        setError(e.message);
      }
  }
  useEffect(() => {
    setFilters(empty());
  }, [warehouseId]);
  useEffect(() => {
    load();
  }, [
    warehouseId,
    search,
    filters.from,
    filters.to,
    filters.status,
    filters.page,
  ]);
  async function open(id) {
    try {
      setDetail(await getQuote(id));
    } catch (e) {
      setError(e.message);
    }
  }
  async function cancel(quote = detail) {
    try {
      const updated = await updateQuoteStatus(quote.id, "CANCELLED");
      if (detail?.id === quote.id) setDetail(updated);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  const convert = (quote, documentType) =>
    onNavigate("pos", { quote, documentType });
  async function rowAction(item, action) {
    try {
      setRowMenu(null);
      const quote = await getQuote(item.id);
      if (action === "print") setPrintTarget(quote);
      if (action === "edit") onNavigate("pos", { mode: "QUOTE", quote, editQuote: true });
      if (action === "cancel") await cancel(quote);
      if (action === "delivery") convert(quote, "DELIVERY_NOTE");
      if (action === "invoice") convert(quote, "BON_POUR");
    } catch (e) { setError(e.message); }
  }
  return (
    <div className="h-full overflow-auto bg-[#f5f7f5] p-5">
      <section className="flex h-full w-full flex-col border border-gray-300 bg-white">
        <header className="flex items-center gap-3 border-b p-5">
          <FileText className="text-[#099323]" />
          <div>
            <h1 className="font-bold">{t("Factures proforma / Devis")}</h1>
            <p className="text-[12px] text-black/55">
              {t("Documents commerciaux sans mouvement de stock ni règlement")}
            </p>
          </div>
          <div className="ms-auto flex gap-2">
            <ExportButton
              entity="quotes"
              query={{ ...filters, search, warehouse_id: warehouseId }}
              onError={setError}
            />
            <Button
              variant="primary"
              onClick={() => onNavigate("pos", { mode: "QUOTE" })}
            >
              {t("Nouveau devis")}
            </Button>
          </div>
        </header>
        <ErrorMessage message={error} onClose={() => setError("")} />
        <DocumentFilters
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(empty())}
          placeholder={t("N° proforma, client, référence...")}
          statuses={[
            "DRAFT",
            "SENT",
            "ACCEPTED",
            "REJECTED",
            "CONVERTED",
            "CANCELLED",
          ].map((value) => ({ value, label: statusMap[value]?.[0] || value }))}
        />
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0">
              <tr className="h-11 border-b border-gray-300 bg-gray-50">
                <Th>{t("N° proforma")}</Th>
                <Th>{t("date")}</Th>
                <Th>{t("Client")}</Th>
                <Th>{t("Validité")}</Th>
                <Th right>{t("Total")}</Th>
                <Th>{t("status")}</Th>
                <Th right>{t("actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => open(item.id)}
                  className="h-12 cursor-pointer border-b border-gray-200 transition-colors hover:bg-gray-50"
                >
                  <td className="px-5 text-[12px] font-semibold">
                    {item.quote_number}
                  </td>
                  <Td>{formatDate(item.quote_date, language)}</Td>
                  <Td>{item.customer_name}</Td>
                  <Td>
                    {item.valid_until
                      ? formatDate(item.valid_until, language)
                      : "—"}
                  </Td>
                  <td className="px-4 text-right text-[12px] tabular-nums">
                    {formatMoney(item.total, language)}
                  </td>
                  <Td>
                    <QuoteStatus status={item.status} />
                  </Td>
                  <td className="relative px-4 text-right" onClick={(event) => event.stopPropagation()}>
                    <button type="button" aria-label={t("actions")} onClick={() => setRowMenu((current) => current === item.id ? null : item.id)} className="inline-flex h-8 w-8 items-center justify-center border border-gray-400 bg-white"><MoreHorizontal size={17} /></button>
                    {rowMenu === item.id && <div className="absolute right-4 top-10 z-30 min-w-[210px] border border-gray-300 bg-white p-1 text-left shadow-lg">
                      <MenuAction onClick={() => rowAction(item, "print")}>{t("reprint")}</MenuAction>
                      {item.status === "DRAFT" && <MenuAction onClick={() => rowAction(item, "edit")}>{t("Modifier")}</MenuAction>}
                      {item.status === "DRAFT" && <MenuAction onClick={() => rowAction(item, "cancel")} danger>{t("Supprimer / Annuler")}</MenuAction>}
                      {!['CONVERTED', 'CANCELLED'].includes(item.status) && <MenuAction onClick={() => rowAction(item, "delivery")}>{t("Créer Bon de livraison")}</MenuAction>}
                      {!['CONVERTED', 'CANCELLED'].includes(item.status) && <MenuAction onClick={() => rowAction(item, "invoice")}>{t("Créer Bon pour")}</MenuAction>}
                    </div>}
                  </td>
                </tr>
              ))}
              {!data.items.length && (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-black/40">
                    {t("Aucun devis correspondant aux filtres")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 ps-5">
          <span className="text-[12px]">
            <b>{data.pagination.total || 0}</b> {t("quotes")}
          </span>
          <Pagination
            page={data.pagination.page || 1}
            totalPages={data.pagination.pages || 1}
            onPageChange={(page) =>
              setFilters((current) => ({ ...current, page }))
            }
          />
        </div>
      </section>
      <QuotePrintDialog
        quote={printTarget}
        onClose={() => setPrintTarget(null)}
        setError={setError}
      />
      <Modal
        open={!!detail}
        title={detail?.quote_number || ""}
        onClose={() => setDetail(null)}
        width="xl"
        footer={<Button onClick={() => setDetail(null)}>{t("close")}</Button>}
      >
        {detail && (
          <div className="p-5 text-[12px] text-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle>{t("Informations")}</SectionTitle>
              <QuoteStatus status={detail.status} />
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label={t("Client")} value={detail.customer_name} />
              <Info
                label={t("date")}
                value={formatDate(detail.quote_date, language)}
              />
              <Info
                label={t("Validité")}
                value={
                  detail.valid_until
                    ? formatDate(detail.valid_until, language)
                    : "—"
                }
              />
              <Info
                label={t("reference")}
                value={detail.customer_reference || "—"}
              />
              {detail.converted_sale_number && (
                <Info
                  label={t("Document lié")}
                  value={detail.converted_sale_number}
                />
              )}
            </div>
            <SectionTitle className="mt-5">{t("items")}</SectionTitle>
            <div className="overflow-x-auto border border-gray-200">
              <table className="min-w-[650px] w-full border-collapse">
                <thead>
                  <tr className="h-10 border-b border-gray-300 bg-gray-100">
                    <Th>{t("Article")}</Th>
                    <Th>{t("Qté")}</Th>
                    <Th>{t("unit")}</Th>
                    <Th right>{t("Prix")}</Th>
                    <Th right>{t("Total")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => (
                    <tr
                      key={line.id}
                      className="h-11 border-b border-gray-200 last:border-b-0"
                    >
                      <td className="px-5 text-[12px]">{line.designation}</td>
                      <td className="px-4 text-center text-[12px] tabular-nums">
                        {line.quantity}
                      </td>
                      <Td>{line.unit_name}</Td>
                      <td className="px-4 text-right text-[12px] tabular-nums">
                        {formatMoney(line.unit_price, language)}
                      </td>
                      <td className="px-4 text-right text-[12px] font-semibold tabular-nums">
                        {formatMoney(line.total, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ms-auto mt-4 w-full max-w-[330px] border border-gray-200 bg-gray-50 p-4">
              {detail.subtotal != null && (
                <Summary
                  label={t("subtotal")}
                  value={detail.subtotal}
                  language={language}
                />
              )}
              {Number(detail.line_discount_total || 0) +
                Number(detail.global_discount_amount || 0) >
                0 && (
                <Summary
                  label={t("discount")}
                  value={
                    -(
                      Number(detail.line_discount_total || 0) +
                      Number(detail.global_discount_amount || 0)
                    )
                  }
                  language={language}
                />
              )}
              <Summary
                label={t("Total")}
                value={detail.total}
                language={language}
                strong
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const statusMap = {
  DRAFT: ["Brouillon", "warning"],
  SENT: ["Envoyé", "info"],
  ACCEPTED: ["Accepté", "success"],
  REJECTED: ["Rejeté", "danger"],
  CONVERTED: ["Converti", "success"],
  CANCELLED: ["Annulé", "danger"],
  EXPIRED: ["Expiré", "neutral"],
};
function QuoteStatus({ status }) {
  const [label, tone] = statusMap[status] || [status, "neutral"];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
function SectionTitle({ children, className = "" }) {
  return (
    <h3
      className={`mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-black/55 ${className}`}
    >
      {children}
    </h3>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-black/45">
        {label}
      </div>
      <div className="mt-1 text-[12px] font-medium">{value || "—"}</div>
    </div>
  );
}
function Summary({ label, value, language, strong = false }) {
  return (
    <div
      className={`flex justify-between gap-4 py-1.5 tabular-nums ${strong ? "mt-1 border-t border-gray-300 pt-3 text-[15px] font-bold" : "text-[12px]"}`}
    >
      <span>{label}</span>
      <span>{formatMoney(value, language)}</span>
    </div>
  );
}
function MenuAction({ children, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 ${danger ? "text-red-700" : ""}`}
    >
      {children}
    </button>
  );
}
