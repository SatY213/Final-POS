import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination";
import DocumentFilters from "../../components/ui/DocumentFilters";
import ErrorMessage from "../../components/ui/ErrorMessage";
import BusinessStatusBadge from "../../components/ui/BusinessStatusBadge";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { formatDate } from "../../utils/formatters";
import { deliverDelivery, getDeliveries, getDelivery, validateDelivery } from "../../api/commercial.model";
import { getRuntimeSettings } from "../../utils/runtimeSettings";
import { useLanguage } from "../../i18n/LanguageContext";

export default function Deliveries({ warehouseId }) {
  const { t, language } = useLanguage();
  const empty = () => ({
    search: "",
    from: "",
    to: "",
    status: "",
    page: 1,
    limit: Number(getRuntimeSettings().default_page_size || 25),
  });
  const [filters, setFilters] = useState(empty);
  const search = useDebouncedValue(filters.search);
  const [data, setData] = useState({ items: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [detail, setDetail] = useState(null);
  const [confirmShip, setConfirmShip] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!warehouseId) return;
    try {
      setData(await getDeliveries({ warehouse_id: warehouseId, ...filters, search }));
    } catch (reason) {
      setError(reason.message);
    }
  }
  useEffect(() => setFilters(empty()), [warehouseId]);
  useEffect(() => {
    load();
  }, [warehouseId, search, filters.from, filters.to, filters.status, filters.page]);

  async function open(id) {
    try {
      setDetail(await getDelivery(id));
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function action(operation) {
    try {
      const next = await operation(detail.id);
      setDetail(next);
      setConfirmShip(false);
      load();
    } catch (reason) {
      setError(reason.message);
    }
  }
  const statuses = [
    { value: "PREPARED", label: t("deliveryPrepared") },
    { value: "SHIPPED", label: t("deliveryShipped") },
    { value: "DELIVERED", label: t("deliveryDelivered") },
  ];

  return <div className="h-full overflow-auto bg-[#f5f7f5] p-5">
    <section className="flex h-full w-full flex-col border border-gray-300 bg-white">
      <header className="flex items-center gap-3 border-b p-5">
        <Truck className="text-[#099323]" />
        <div><h1 className="font-bold">{t("deliveries")}</h1><p className="text-[12px] text-black/55">{t("deliveriesDescription")}</p></div>
      </header>
      <ErrorMessage message={error} onClose={() => setError("")} />
      <DocumentFilters filters={filters} onChange={setFilters} onReset={() => setFilters(empty())} placeholder={t("searchDeliveries")} statuses={statuses} />
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[12px] rtl:text-right">
          <thead className="sticky top-0 z-10"><tr className="h-11 border-b border-gray-300 bg-gray-50"><th className="px-4">{t("saleNumber")}</th><th className="px-3">{t("date")}</th><th className="px-3">{t("customer")}</th><th className="px-3">{t("quantity")}</th><th className="px-3">{t("status")}</th></tr></thead>
          <tbody>
            {data.items.map((item) => <tr key={item.id} onClick={() => open(item.id)} className="h-12 cursor-pointer border-b border-gray-200 hover:bg-green-50"><td className="px-4 font-bold">{item.sale_number}</td><td className="px-3">{formatDate(item.delivery_date, language)}</td><td className="px-3">{item.customer_name}</td><td className="px-3">{item.quantity}</td><td className="px-3"><BusinessStatusBadge value={item.status} /></td></tr>)}
            {!data.items.length && <tr><td colSpan="5" className="p-12 text-center text-black/40">{t("noDeliveries")}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-gray-200 ps-5"><span className="text-[12px]"><b>{data.pagination.total || 0}</b> {t("documents")}</span><Pagination page={data.pagination.page || 1} totalPages={data.pagination.pages || 1} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} /></div>
    </section>
    <Modal open={Boolean(detail)} title={detail?.sale_number || t("deliveries")} onClose={() => setDetail(null)} width="lg" footer={<>{detail?.status === "PREPARED" && <Button variant="primary" onClick={() => setConfirmShip(true)}>{t("markAsShipped")}</Button>}{detail?.status === "SHIPPED" && <Button variant="primary" onClick={() => action(deliverDelivery)}>{t("markAsDelivered")}</Button>}<Button onClick={() => setDetail(null)}>{t("close")}</Button></>}>
      {detail && <div className="p-5 text-[12px]"><p className="mb-3"><b>{t("sale")} {detail.sale_number}</b> · {detail.customer_name} · {detail.warehouse_name}</p>{detail.lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_140px] items-center border-b py-3"><span>{line.designation}</span><b className="text-right rtl:text-left">{line.quantity} {line.unit_name}</b></div>)}</div>}
    </Modal>
    <Modal open={confirmShip} title={t("confirmShipping")} onClose={() => setConfirmShip(false)} width="sm" footer={<><Button onClick={() => setConfirmShip(false)}>{t("cancel")}</Button><Button variant="primary" onClick={() => action(validateDelivery)}>{t("ship")}</Button></>}><div className="p-5 text-[13px]">{t("confirmShippingMessage")}</div></Modal>
  </div>;
}
