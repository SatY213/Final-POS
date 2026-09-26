import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ErrorMessage from "../../components/ui/ErrorMessage";
import { formatMoney } from "../../utils/formatters";
import { getPurchaseOrder, getPurchaseOrders } from "../../api/purchase.model";
import PurchasePrintDialog from "./PurchasePrintDialog";
import BusinessStatusBadge from "../../components/ui/BusinessStatusBadge";
import Th from "../../components/ui/Th";
import Td from "../../components/ui/Td";
import ExportButton from "../../components/data-exchange/ExportButton";
import { useLanguage } from "../../i18n/LanguageContext";
import { fuzzyIncludes } from "../../utils/search";
const labels = {
  NOT_RECEIVED: "Non reçu",
  PARTIALLY_RECEIVED: "Partiellement reçu",
  RECEIVED: "Reçu",
};
export default function PurchaseOrders({ warehouseId, onNavigate }) {
  const { t } = useLanguage();
  const [items, setItems] = useState([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [detail, setDetail] = useState(null),
    [menu, setMenu] = useState(null),
    [print, setPrint] = useState(null);
  const reload = async () => {
    try {
      setItems(await getPurchaseOrders(warehouseId));
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    if (warehouseId) reload();
  }, [warehouseId]);
  const rows = useMemo(
    () =>
      items.filter((item) =>
        fuzzyIncludes(search, item.order_number, item.supplier_name),
      ),
    [items, search],
  );
  const open = async (row) => {
    try {
      setDetail(await getPurchaseOrder(row.id));
    } catch (e) {
      setError(e.message);
    }
  };
  const receipt = async (row) => {
    try {
      onNavigate("pop", { order: await getPurchaseOrder(row.id) });
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f6f5] p-4 lg:p-5">
      <section className="mx-auto flex h-full w-full max-w-[1550px] min-h-0 flex-col border border-gray-300 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h1 className="text-[18px] font-black">{t("purchaseOrders")}</h1>
            <p className="text-[11px] text-black/50">
              {t("Suivi des commandes fournisseurs")}
            </p>
          </div>
          <div className="flex gap-2">
            <ExportButton
              entity="purchase_orders"
              query={{ warehouse_id: warehouseId, search }}
              onError={setError}
            />
            <Button onClick={() => onNavigate("purchases")}>{t("Achats")}</Button>
            <Button variant="primary" onClick={() => onNavigate("pop")}>
              <Plus size={15} />
              {t("Nouvelle commande")}
            </Button>
          </div>
        </header>
        <ErrorMessage message={error} onClose={() => setError("")} />
        <div className="border-b p-3">
          <input
            className="h-10 w-full max-w-xl border border-gray-400 px-3 text-[12px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Rechercher un bon de commande ou un fournisseur…")}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0">
              <tr className="h-11 border-b border-gray-300 bg-gray-50">
                <Th>{t("N° commande")}</Th>
                <Th>{t("date")}</Th>
                <Th>{t("supplier")}</Th>
                <Th>{t("Réception")}</Th>
                <Th right>{t("Total")}</Th>
                <Th right>{t("actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => open(row)}
                  className="h-12 cursor-pointer border-b border-gray-200 transition-colors hover:bg-gray-50"
                >
                  <td className="px-5 text-[12px] font-semibold">
                    {row.order_number}
                  </td>
                  <Td>{row.order_date}</Td>
                  <Td>{row.supplier_name}</Td>
                  <Td>
                    <BusinessStatusBadge value={row.status} />
                  </Td>
                  <td className="px-4 text-right text-[12px] tabular-nums">
                    {formatMoney(row.total)}
                  </td>
                  <td
                    data-sales-row-menu
                    className="relative px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="inline-flex h-8 w-8 items-center justify-center border border-gray-400 bg-white"
                      onClick={() => setMenu(menu === row.id ? null : row.id)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                    {menu === row.id && (
                      <div className="absolute right-4 top-10 z-30 min-w-[180px] border border-gray-300 bg-white p-1 text-left shadow-lg rtl:left-4 rtl:right-auto rtl:text-right">
                        <MenuButton onClick={() => setPrint(row)}>
                          {t("reprint")}
                        </MenuButton>
                        <MenuButton onClick={() => open(row)}>
                          {t("details")}
                        </MenuButton>
                        {row.status !== "RECEIVED" && (
                          <MenuButton onClick={() => receipt(row)}>
                            {t("Créer une réception")}
                          </MenuButton>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="6" className="p-16 text-center text-black/40">
                    {t("Aucune commande")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <OrderDetail
        detail={detail}
        onClose={() => setDetail(null)}
        onReceipt={() => receipt(detail)}
      />
      <PrintDialog
        document={print}
        onClose={() => setPrint(null)}
        setError={setError}
      />
    </div>
  );
}
const MenuButton = ({ children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="block h-9 w-full px-3 text-left text-[12px] hover:bg-gray-100 rtl:text-right"
  >
    {children}
  </button>
);
const PrintDialog = ({ document, onClose, setError }) => (
  <PurchasePrintDialog
    document={document}
    kind="ORDER"
    onClose={onClose}
    setError={setError}
  />
);
function OrderDetail({ detail, onClose, onReceipt }) {
  const { t } = useLanguage();
  if (!detail) return null;
  return (
    <Modal
      open
      title={detail.order_number}
      onClose={onClose}
      width="xl"
      footer={
        <>
          <Button onClick={onClose}>{t("close")}</Button>
          {detail.status !== "RECEIVED" && (
            <Button variant="primary" onClick={onReceipt}>
              {t("Créer une réception")}
            </Button>
          )}
        </>
      }
    >
      <div className="p-5 text-[12px]">
        <div className="mb-5 grid grid-cols-2 gap-4 border bg-gray-50 p-4 lg:grid-cols-4">
          <Info label={t("supplier")} value={detail.supplier_name} />
          <Info label={t("date")} value={detail.order_date} />
          <Info label={t("warehouse")} value={detail.warehouse_name} />
          <Info
            label={t("Réception")}
            value={t(labels[detail.status] || detail.status)}
          />
        </div>
        <table className="w-full border text-left text-[11px]">
          <thead>
            <tr className="h-10 border-b bg-gray-50">
              <th className="px-4">{t("designation")}</th>
              <th className="text-right">{t("ORDERED")}</th>
              <th className="text-right">{t("received")}</th>
              <th className="text-right">{t("Restant")}</th>
              <th className="px-4 text-right">{t("Prix unitaire")}</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((x) => (
              <tr key={x.id} className="h-11 border-b">
                <td className="px-4 font-semibold">{x.designation}</td>
                <td className="text-right">{x.quantity}</td>
                <td className="text-right">{x.received_quantity}</td>
                <td className="text-right">{x.remaining_quantity}</td>
                <td className="px-4 text-right">{formatMoney(x.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] font-bold uppercase text-black/45">{label}</div>
    <div className="mt-1 font-semibold">{value || "—"}</div>
  </div>
);
