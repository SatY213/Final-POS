import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  SlidersHorizontal as MinusPlus,
  PackagePlus,
  Search,
  X,
} from "lucide-react";
import {
  adjustStock,
  getInventoryProducts,
  getStock,
  getStockBatches,
  getStockMovements,
  receiveStock,
  transferStock,
} from "../../api/inventory.model";
import { useLanguage } from "../../i18n/LanguageContext";

const emptyFilters = { search: "", status: "all", page: 1, limit: 25 };
export default function Stock({ warehouseId, warehouses, warehouseError }) {
  const { t, language } = useLanguage();
  const [mode, setMode] = useState("list"),
    [filters, setFilters] = useState(emptyFilters),
    [data, setData] = useState({
      items: [],
      pagination: { page: 1, total: 0, total_pages: 1 },
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function load() {
    if (!warehouseId) {
      setError(warehouseError || t("noWarehouseContext"));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      setData(await getStock({ ...filters, warehouse_id: warehouseId }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [filters, warehouseId]);
  function done() {
    setMode("list");
    load();
  }
  return (
    <div className="flex h-full flex-col bg-[#f5f7f5]">
      <main className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-[1500px]">
          {mode === "list" ? (
            <section className="border border-gray-300 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center bg-[#fff4df] text-[#b86e00]">
                    <Boxes size={20} />
                  </div>
                  <div>
                    <h1 className="text-[17px] font-bold">{t("stock")}</h1>
                    <p className="mt-1 text-[12px] text-black/55">
                      {t("stockDescription")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Action icon={PackagePlus} onClick={() => setMode("receive")}>
                    {t("receiveStock")}
                  </Action>
                  <Action icon={MinusPlus} onClick={() => setMode("adjust")}>
                    {t("adjustStock")}
                  </Action>
                  <Action icon={ArrowLeftRight} onClick={() => setMode("transfer")}>
                    {t("transferStock")}
                  </Action>
                  <Action icon={ClipboardList} onClick={() => setMode("history")}>
                    {t("movementHistory")}
                  </Action>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 border-b border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_auto]">
                <label className="relative">
                  <Search
                    size={16}
                    className="absolute start-3 top-[13px] text-black/45"
                  />
                  <input
                    value={filters.search}
                    onChange={(e) =>
                      setFilters((current) => ({
                        ...current,
                        search: e.target.value,
                        page: 1,
                      }))
                    }
                    placeholder={t("searchProducts")}
                    className="h-[42px] w-full border border-gray-400 bg-white ps-9 pe-3 text-[12px] outline-none"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {["all", "low", "out", "expired", "expiring"].map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() =>
                          setFilters((current) => ({
                            ...current,
                            status,
                            page: 1,
                          }))
                        }
                        className={`h-[42px] border px-3 text-[12px] font-semibold ${filters.status === status ? "border-[#087c1e] bg-[#e8f7eb] text-[#087c1e]" : "border-gray-400 bg-white"}`}
                      >
                        {t(
                          {
                            all: "all",
                            low: "lowStock",
                            out: "outOfStock",
                            expired: "expired",
                            expiring: "expiringSoon",
                          }[status],
                        )}
                      </button>
                    ),
                  )}
                </div>
              </div>
              {error && <Error text={error} />}
              <StockTable
                items={data.items}
                loading={loading}
                t={t}
                language={language}
              />
              <Pager
                pagination={data.pagination}
                onPage={(page) =>
                  setFilters((current) => ({ ...current, page }))
                }
              />
            </section>
          ) : mode === "history" ? (
            <History
              warehouseId={warehouseId}
              onClose={() => setMode("list")}
            />
          ) : (
            <Operation
              mode={mode}
              warehouseId={warehouseId}
              warehouses={warehouses}
              onDone={done}
              onCancel={() => setMode("list")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
function Action({ icon: Icon, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-[40px] items-center gap-2 border border-gray-400 bg-white px-3 text-[12px] font-semibold"
    >
      <Icon size={16} />
      {children}
    </button>
  );
}
function StockTable({ items, loading, t, language }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left rtl:text-right">
        <thead>
          <tr className="h-[44px] border-b border-gray-300 bg-gray-50">
            <Th>{t("product")}</Th>
            <Th>{t("reference")}</Th>
            <Th>{t("category")}</Th>
            <Th>{t("baseUnit")}</Th>
            <Th>{t("stock")}</Th>
            <Th>{t("minimumStock")}</Th>
            <Th>{t("status")}</Th>
            <Th>{t("batches")}</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan="8"
                className="h-32 text-center text-[13px] text-black/50"
              >
                {t("loadingStock")}
              </td>
            </tr>
          ) : !items.length ? (
            <tr>
              <td
                colSpan="8"
                className="h-40 text-center text-[13px] text-black/50"
              >
                <Boxes size={24} className="mx-auto mb-3" />
                {t("noStockItems")}
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="h-[48px] border-b border-gray-200">
                <td className="px-5 text-[13px] font-semibold">
                  {item.designation}
                </td>
                <Td>{item.reference || "-"}</Td>
                <Td>{item.category_name || "-"}</Td>
                <Td>
                  {item.unit_is_builtin
                    ? "-"
                    : item.unit_symbol || item.unit_name}
                </Td>
                <Td>
                  <b>{Number(item.quantity).toLocaleString(language)}</b>
                </Td>
                <Td>{Number(item.min_stock).toLocaleString(language)}</Td>
                <Td>
                  <Status item={item} t={t} />
                </Td>
                <Td>{item.track_batches ? item.batch_count : "-"}</Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
function Status({ item, t }) {
  if (!item.track_stock)
    return (
      <span className="text-[11px] font-semibold text-black/45">
        {t("notTracked")}
      </span>
    );
  const key =
      item.quantity <= 0
        ? "outOfStock"
        : item.quantity <= item.min_stock
          ? "lowStock"
          : "inStock",
    color =
      key === "outOfStock"
        ? "text-red-700"
        : key === "lowStock"
          ? "text-amber-700"
          : "text-green-700";
  return <span className={`text-[11px] font-semibold ${color}`}>{t(key)}</span>;
}
function Operation({ mode, warehouseId, warehouses, onDone, onCancel }) {
  const { t, language } = useLanguage();
  const [products, setProducts] = useState([]),
    [productId, setProductId] = useState(""),
    [unitId, setUnitId] = useState(""),
    [quantity, setQuantity] = useState(""),
    [direction, setDirection] = useState("in"),
    [batchNumber, setBatchNumber] = useState(""),
    [expiration, setExpiration] = useState(""),
    [batchId, setBatchId] = useState(""),
    [batches, setBatches] = useState([]),
    [destination, setDestination] = useState(""),
    [note, setNote] = useState(""),
    [price, setPrice] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    getInventoryProducts(warehouseId)
      .then(setProducts)
      .catch((err) => setError(err.message));
  }, [warehouseId]);
  const product = products.find((item) => String(item.id) === productId),
    units = product?.product_units || [],
    unit = units.find((item) => String(item.id) === unitId) || units[0];
  useEffect(() => {
    if (product) {
      setUnitId(String(product.product_units[0]?.id || ""));
      if (product.track_batches)
        getStockBatches(warehouseId, product.id)
          .then(setBatches)
          .catch((err) => setError(err.message));
      else setBatches([]);
    }
  }, [productId, warehouseId]);
  const base = Number(quantity || 0) * Number(unit?.conversion_factor || 0),
    removing =
      (mode === "adjust" && direction === "out") || mode === "transfer";
  async function submit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const common = {
        warehouse_id: Number(warehouseId),
        product_id: Number(productId),
        product_unit_id: Number(unitId),
        quantity: Number(quantity),
        note,
      };
      if (mode === "receive")
        await receiveStock({
          ...common,
          batch_number: batchNumber,
          expiration_date: expiration,
          purchase_price: price === "" ? null : Number(price),
        });
      if (mode === "adjust")
        await adjustStock({
          ...common,
          direction,
          batch_id: Number(batchId) || null,
          batch_number: batchNumber,
          expiration_date: expiration,
          purchase_price: price === "" ? null : Number(price),
        });
      if (mode === "transfer")
        await transferStock({
          source_warehouse_id: Number(warehouseId),
          destination_warehouse_id: Number(destination),
          product_id: Number(productId),
          product_unit_id: Number(unitId),
          quantity: Number(quantity),
          batch_id: Number(batchId) || null,
          note,
        });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  const title = t(
    {
      receive: "receiveStock",
      adjust: "adjustStock",
      transfer: "transferStock",
    }[mode],
  );
  return (
    <form onSubmit={submit} className="border border-gray-300 bg-white">
      <PanelHeader title={title} onClose={onCancel} />
      {error && <Error text={error} />}
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label={t("product")}
            value={productId}
            onChange={setProductId}
            options={products.map((item) => ({
              id: item.id,
              name: `${item.designation}${item.reference ? ` - ${item.reference}` : ""}`,
            }))}
          />
          <Select
            label={t("packaging")}
            value={unitId}
            onChange={setUnitId}
            options={units.map((item) => ({
              id: item.id,
              name: item.is_base
                ? `${item.unit_name} (${t("baseUnit")})`
                : item.unit_name,
            }))}
          />
          {mode === "adjust" && (
            <Select
              label={t("adjustmentDirection")}
              value={direction}
              onChange={setDirection}
              options={[
                { id: "in", name: t("addStock") },
                { id: "out", name: t("removeStock") },
              ]}
            />
          )}{" "}
          {mode === "transfer" && (
            <Select
              label={t("destinationWarehouse")}
              value={destination}
              onChange={setDestination}
              options={warehouses.filter(
                (item) => Number(item.id) !== Number(warehouseId),
              )}
            />
          )}
          <Input
            label={t("quantity")}
            type="number"
            min="0.000001"
            step="any"
            value={quantity}
            onChange={setQuantity}
          />
          {product?.track_batches &&
            (removing ? (
              <Select
                label={t("batchLot")}
                value={batchId}
                onChange={setBatchId}
                options={batches.map((item) => ({
                  id: item.id,
                  name: `${item.batch_number} - ${item.quantity}`,
                }))}
              />
            ) : (
              <Input
                label={t("batchLot")}
                value={batchNumber}
                onChange={setBatchNumber}
              />
            ))}
          {product?.track_expiration && !removing && (
            <Input
              label={t("expirationDate")}
              type="date"
              value={expiration}
              onChange={setExpiration}
            />
          )}{" "}
          {mode !== "transfer" && !removing && (
            <Input
              label={t("purchasePriceOptional")}
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={setPrice}
            />
          )}
          <Input label={t("note")} value={note} onChange={setNote} />
        </div>
        {product && unit && (
          <div className="border border-green-200 bg-green-50 px-4 py-3 text-[12px]">
            <b>1 {unit.unit_name}</b> = {unit.conversion_factor}{" "}
            {unit.base_unit_symbol || unit.base_unit_name}. {t("baseQuantity")}:{" "}
            <b>
              {base.toLocaleString(language)}{" "}
              {unit.base_unit_symbol ||
                (!unit.is_base ? unit.base_unit_name : "")}
            </b>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-[42px] border border-gray-400 px-5 text-[13px] font-semibold"
        >
          {t("cancel")}
        </button>
        <button
          disabled={
            saving ||
            !productId ||
            !unitId ||
            !quantity ||
            (mode === "transfer" && !destination)
          }
          className="h-[42px] border border-[#087c1e] bg-[#099323] px-5 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {saving ? t("saving") : title}
        </button>
      </div>
    </form>
  );
}
function History({ warehouseId, onClose }) {
  const { t, language } = useLanguage();
  const [filters, setFilters] = useState({ type: "", page: 1, limit: 25 }),
    [data, setData] = useState({
      movements: [],
      pagination: { page: 1, total_pages: 1 },
    }),
    [error, setError] = useState("");
  useEffect(() => {
    getStockMovements({ ...filters, warehouse_id: warehouseId })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [filters, warehouseId]);
  return (
    <section className="border border-gray-300 bg-white">
      <PanelHeader title={t("movementHistory")} onClose={onClose} />
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <Select
          value={filters.type}
          onChange={(type) =>
            setFilters((current) => ({ ...current, type, page: 1 }))
          }
          options={[
            { id: "", name: t("allMovementTypes") },
            ...[
              "RECEIPT",
              "ADJUSTMENT_IN",
              "ADJUSTMENT_OUT",
              "TRANSFER_IN",
              "TRANSFER_OUT",
              "INITIAL_STOCK",
            ].map((id) => ({ id, name: t(id) })),
          ]}
        />
      </div>
      {error && <Error text={error} />}
      <div className="overflow-x-auto">
        <table className="w-full text-left rtl:text-right">
          <thead>
            <tr className="h-11 border-b border-gray-300 bg-gray-50">
              <Th>{t("dateTime")}</Th>
              <Th>{t("product")}</Th>
              <Th>{t("type")}</Th>
              <Th>{t("quantity")}</Th>
              <Th>{t("batchLot")}</Th>
              <Th>{t("reference")}</Th>
              <Th>{t("user")}</Th>
              <Th>{t("note")}</Th>
            </tr>
          </thead>
          <tbody>
            {data.movements.map((row) => (
              <tr key={row.id} className="h-12 border-b border-gray-200">
                <Td>
                  {new Intl.DateTimeFormat(language, {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(`${row.created_at.replace(" ", "T")}Z`))}
                </Td>
                <Td>{row.designation}</Td>
                <Td>{t(row.type)}</Td>
                <Td>
                  <span
                    className={
                      row.quantity > 0
                        ? "font-semibold text-green-700"
                        : "font-semibold text-red-700"
                    }
                  >
                    {row.quantity > 0 ? "+" : ""}
                    {row.quantity} {row.unit_symbol || ""}
                  </span>
                </Td>
                <Td>{row.batch_number || "-"}</Td>
                <Td>{row.reference_id || "-"}</Td>
                <Td>{row.user_name}</Td>
                <Td>{row.note || "-"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        pagination={data.pagination}
        onPage={(page) => setFilters((current) => ({ ...current, page }))}
      />
    </section>
  );
}
function PanelHeader({ title, onClose }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
      <h2 className="text-[17px] font-bold">{title}</h2>
      <button
        onClick={onClose}
        type="button"
        title={t("close")}
        className="flex h-9 w-9 items-center justify-center border border-gray-400"
      >
        <X size={17} />
      </button>
    </div>
  );
}
function Select({ label, value, onChange, options = [] }) {
  return (
    <label>
      <span className="mb-2 block text-[11px] font-semibold">{label}</span>
      <select
        required={Boolean(label)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[42px] w-full border border-gray-400 bg-white px-3 text-[12px]"
      >
        <option value="">{label || "-"}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function Input({ label, onChange, ...props }) {
  return (
    <label>
      <span className="mb-2 block text-[11px] font-semibold">{label}</span>
      <input
        {...props}
        onChange={(e) => onChange(e.target.value)}
        className="h-[42px] w-full border border-gray-400 px-3 text-[12px] outline-none"
      />
    </label>
  );
}
function Pager({ pagination, onPage }) {
  return (
    <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
      <button
        disabled={pagination.page <= 1}
        onClick={() => onPage(pagination.page - 1)}
        className="flex h-8 w-8 items-center justify-center border border-gray-400 disabled:opacity-30"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="min-w-20 py-2 text-center text-[11px]">
        {pagination.page} / {pagination.total_pages}
      </span>
      <button
        disabled={pagination.page >= pagination.total_pages}
        onClick={() => onPage(pagination.page + 1)}
        className="flex h-8 w-8 items-center justify-center border border-gray-400 disabled:opacity-30"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
function Error({ text }) {
  return (
    <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-[12px] text-red-700">
      {text}
    </div>
  );
}
function Th({ children }) {
  return (
    <th className="px-4 text-[12px] font-semibold first:px-5">{children}</th>
  );
}
function Td({ children }) {
  return <td className="px-4 text-[12px]">{children}</td>;
}
