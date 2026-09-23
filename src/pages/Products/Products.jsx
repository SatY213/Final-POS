import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderCog,
  Package,
  Plus,
  Printer,
  Ruler,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  getCategories,
  deleteProduct,
  getProduct,
  getProducts,
  getUnits,
  setProductActive,
} from "../../api/product.model";
import { getPrintProfiles } from "../../api/settings.model";
import { useLanguage } from "../../i18n/LanguageContext";
import ProductForm from "./ProductForm";
import SupportingManager from "./components/SupportingManager";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import SearchableSelect from "../../components/ui/SearchableSelect";
import Th from "../../components/ui/Th";
import Td from "../../components/ui/Td";
import BarcodeLabelDialog from "./BarcodeLabelDialog";
import ErrorMessage from "../../components/ui/ErrorMessage";
import Modal from "../../components/ui/Modal";
import { formatMoney } from "../../utils/formatters";
import { getRuntimeSettings } from "../../utils/runtimeSettings";
import DataExchangeDialog from "../../components/data-exchange/DataExchangeDialog";
import { exportData } from "../../api/data-exchange.model";

const defaultFilters = () => ({
  search: "",
  category_id: "",
  status: "active",
  stock_status: "all",
  tracking: "all",
  page: 1,
  limit: Number(getRuntimeSettings().default_page_size || 25),
  sort: "designation",
  direction: "asc",
});

export default function Products({
  session,
  warehouseId,
  warehouses,
  warehouseError,
  onNavigate,
}) {
  const { language, t } = useLanguage();
  const [mode, setMode] = useState("list");
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: Number(getRuntimeSettings().default_page_size || 25),
    total: 0,
    total_pages: 1,
  });
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [productToDelete, setProductToDelete] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState({});
  const [labelProducts, setLabelProducts] = useState([]);
  const [labelProfile, setLabelProfile] = useState(null);
  const [exchangeEntity, setExchangeEntity] = useState(null);
  const canManage = ["admin", "manager"].includes(session?.user?.role);
  const imagesEnabled = Boolean(getRuntimeSettings().product_images_enabled);
  const debouncedSearch = useDebouncedValue(filters.search);

  async function loadLookups() {
    const [categoryData, unitData, profiles] = await Promise.all([
      getCategories(),
      getUnits(),
      getPrintProfiles(),
    ]);
    setCategories(categoryData);
    setUnits(unitData);
    setLabelProfile(
      profiles.find((profile) => profile.document_type === "BARCODE_LABEL") ||
        null,
    );
  }
  async function loadProducts() {
    if (!warehouseId) {
      setProducts([]);
      setError(warehouseError || t("noWarehouseContext"));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const data = await getProducts({ ...filters, warehouse_id: warehouseId });
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || t("loadProductsFailed"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadLookups().catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    loadProducts();
  }, [
    debouncedSearch,
    filters.category_id,
    filters.status,
    filters.stock_status,
    filters.tracking,
    filters.page,
    filters.limit,
    filters.sort,
    filters.direction,
    warehouseId,
  ]);
  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : 1,
    }));
  }
  async function editProduct(id) {
    try {
      setLoading(true);
      setSelected(await getProduct(id));
      setMode("form");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  async function toggleProduct(product) {
    try {
      setError("");
      await setProductActive(product.id, !product.is_active);
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeProduct(product) {
    if (!product || deletingProductId != null) return;
    try {
      setError("");
      setDeletingProductId(product.id);
      await deleteProduct(product.id);
      setSelectedIds((ids) =>
        ids.filter((id) => Number(id) !== Number(product.id)),
      );
      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingProductId(null);
      setProductToDelete(null);
    }
  }
  function requestProductDelete(product) {
    if (getRuntimeSettings().confirm_destructive_actions) setProductToDelete(product);
    else removeProduct(product);
  }
  async function returnToList(refresh = false) {
    setMode("list");
    setSelected(null);
    if (refresh) await loadProducts();
  }
  const normalizeLabelProduct = (product) => {
    const base =
        product.product_units?.find((unit) => unit.is_base) ||
        product.product_units?.[0],
      barcodeRow =
        base?.barcodes?.find((row) => row.is_primary) || base?.barcodes?.[0];
    return {
      id: product.id,
      designation: product.designation,
      reference: product.reference || "",
      selling_price: Number(base?.selling_price ?? product.selling_price ?? 0),
      barcode: barcodeRow?.barcode || product.primary_barcode || "",
    };
  };
  function openLabels(items) {
    const normalized = items.map(normalizeLabelProduct);
    if (!normalized.length) return;
    setLabelProducts(normalized);
  }
  function changeSelection(nextIds) {
    const uniqueIds = [...new Set(nextIds)];
    setSelectedIds(uniqueIds);
    setSelectedProducts((current) => {
      const next = {};
      uniqueIds.forEach((id) => {
        const visible = products.find((product) => product.id === id);
        if (visible || current[id]) next[id] = visible || current[id];
      });
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-[#f5f7f5] text-black">
      <main className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-[1500px]">
          {mode === "form" && (
            <ProductForm
              product={selected}
              categories={categories}
              units={units}
              warehouses={warehouses}
              activeWarehouseId={warehouseId}
              onLookupsChanged={loadLookups}
              onCancel={() => returnToList()}
              onSaved={() => returnToList(true)}
              onPrintLabel={() => openLabels([selected])}
            />
          )}
          {mode === "categories" && (
            <SupportingManager
              type="category"
              onDone={() => setMode("list")}
              onChanged={loadLookups}
            />
          )}
          {mode === "units" && (
            <SupportingManager
              type="unit"
              onDone={() => setMode("list")}
              onChanged={loadLookups}
            />
          )}
          {mode === "list" && (
            <section className="border border-gray-300 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]">
                    <Package size={20} />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-bold">
                      {t("productCatalog")}
                    </h2>
                    <p className="mt-1 text-[12px] text-black/55">
                      {t("productCatalogDescription")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportData("products", { warehouse_id: warehouseId, search: filters.search, status: filters.status, category_id: filters.category_id }).catch((reason) => setError(reason.message))}
                    className="flex h-[42px] items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"
                  >
                    <Download size={17} />
                    {t("exportData")}
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setExchangeEntity("products")}
                      className="flex h-[42px] items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"
                    >
                      <Upload size={17} />
                      {t("importData")}
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setExchangeEntity("initial_stock")}
                      className="flex h-[42px] items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"
                    >
                      <Upload size={17} />
                      {t("importInitialStock")}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!selectedIds.length || selectedIds.some((id) => !selectedProducts[id]?.primary_barcode)}
                    onClick={() =>
                      openLabels(
                        selectedIds
                          .map((id) => selectedProducts[id])
                          .filter(Boolean),
                      )
                    }
                    className="flex h-[42px] items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold disabled:opacity-40"
                  >
                    <Printer size={17} />
                    {t("printLabels")} ({selectedIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("categories")}
                    className="flex h-[42px] items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"
                  >
                    <FolderCog size={17} />
                    {t("manageCategories")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("units")}
                    className="flex h-[42px] items-center gap-2 border border-gray-400 px-3 text-[12px] font-semibold"
                  >
                    <Ruler size={17} />
                    {t("manageUnits")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setMode("form");
                    }}
                    className="flex h-[42px] items-center gap-2 border border-[#087c1e] bg-[#099323] px-4 text-[13px] font-semibold text-white"
                  >
                    <Plus size={18} />
                    {t("addProduct")}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 border-b border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-5">
                <label className="relative md:col-span-2 xl:col-span-1">
                  <Search
                    size={16}
                    className="absolute start-3 top-[13px] text-black/45"
                  />
                  <input
                    value={filters.search}
                    onChange={(event) =>
                      updateFilter("search", event.target.value)
                    }
                    placeholder={t("searchProducts")}
                    className="h-[42px] w-full border border-gray-400 bg-white ps-9 pe-3 text-[12px] outline-none"
                  />
                </label>
                <SearchableSelect
                  value={filters.category_id}
                  onChange={(value) => updateFilter("category_id", value)}
                  placeholder={t("allCategories")}
                  searchPlaceholder={t("Rechercher une catégorie...")}
                  options={categories.filter((item) => item.is_active)}
                />
                <Filter
                  value={filters.status}
                  onChange={(value) => updateFilter("status", value)}
                  options={[
                    { id: "active", name: t("active") },
                    { id: "inactive", name: t("inactive") },
                    { id: "all", name: t("all") },
                  ]}
                />
                <Filter
                  value={filters.stock_status}
                  onChange={(value) => updateFilter("stock_status", value)}
                  options={[
                    { id: "all", name: t("allStock") },
                    { id: "in_stock", name: t("inStock") },
                    { id: "low_stock", name: t("lowStock") },
                    { id: "out_of_stock", name: t("outOfStock") },
                  ]}
                />
                <Filter
                  value={filters.tracking}
                  onChange={(value) => updateFilter("tracking", value)}
                  options={[
                    { id: "all", name: t("allTracking") },
                    { id: "stock", name: t("trackStock") },
                    { id: "batch", name: t("trackBatches") },
                    { id: "expiration", name: t("trackExpiration") },
                    { id: "serial", name: t("trackSerials") },
                  ]}
                />
              </div>
              <ErrorMessage message={error} onClose={() => setError("")} />
              <ProductsTable
                products={products}
                loading={loading}
                filters={filters}
                t={t}
                language={language}
                onEdit={editProduct}
                onToggle={toggleProduct}
                onDelete={requestProductDelete}
                onAdd={() => setMode("form")}
                onPrint={(product) => openLabels([product])}
                selectedIds={selectedIds}
                onSelectionChange={changeSelection}
                imagesEnabled={imagesEnabled}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-3">
                <p className="text-[11px] text-black/55">
                  {t("productCount").replace("{count}", pagination.total)}
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={filters.limit}
                    onChange={(event) =>
                      updateFilter("limit", Number(event.target.value))
                    }
                    className="h-8 border border-gray-400 bg-white px-2 text-[11px]"
                  >
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => updateFilter("page", pagination.page - 1)}
                    className="flex h-8 w-8 items-center justify-center border border-gray-400 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="min-w-[72px] text-center text-[11px] font-semibold">
                    {pagination.page} / {pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.total_pages}
                    onClick={() => updateFilter("page", pagination.page + 1)}
                    className="flex h-8 w-8 items-center justify-center border border-gray-400 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </section>
          )}
          <BarcodeLabelDialog
            products={labelProducts}
            profile={
              labelProfile || {
                paper_format: "50x30mm",
                configuration: {
                  show_product_name: true,
                  show_price: true,
                  show_reference: true,
                },
              }
            }
            onClose={() => setLabelProducts([])}
            setError={setError}
          />
          <DataExchangeDialog
            open={Boolean(exchangeEntity)}
            entity={exchangeEntity || "products"}
            title={exchangeEntity === "initial_stock" ? t("importInitialStock") : t("importProducts")}
            onClose={() => setExchangeEntity(null)}
            onImported={async () => {
              await loadLookups();
              await loadProducts();
            }}
          />
          <Modal
            open={Boolean(productToDelete)}
            title={t("deleteProduct")}
            onClose={() => !deletingProductId && setProductToDelete(null)}
            width="sm"
            footer={<>
              <button type="button" onClick={() => setProductToDelete(null)} disabled={Boolean(deletingProductId)} className="h-9 border border-gray-400 px-4 text-[12px] font-semibold disabled:opacity-50">{t("cancel")}</button>
              <button type="button" onClick={() => removeProduct(productToDelete)} disabled={Boolean(deletingProductId)} className="h-9 border border-red-700 bg-red-700 px-4 text-[12px] font-semibold text-white disabled:opacity-50">{deletingProductId ? t("deleting") : t("delete")}</button>
            </>}
          >
            <div className="p-5 text-[13px] leading-6 text-black/75">
              {t("confirmDeleteProduct").replace("{product}", productToDelete?.designation || "")}
            </div>
          </Modal>
        </div>
      </main>
    </div>
  );
}

function Filter({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-[42px] min-w-0 border border-gray-400 bg-white px-3 text-[12px] outline-none"
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
function ProductsTable({
  products,
  loading,
  filters,
  t,
  language,
  onEdit,
  onToggle,
  onDelete,
  onAdd,
  onPrint,
  selectedIds,
  onSelectionChange,
  imagesEnabled,
}) {
  const hasFilters =
    filters.search ||
    filters.category_id ||
    filters.status !== "active" ||
    filters.stock_status !== "all" ||
    filters.tracking !== "all";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left rtl:text-right">
        <thead>
          <tr className="h-[44px] border-b border-gray-300 bg-gray-50">
            <th className="w-10 px-4">
              <input
                type="checkbox"
                checked={
                  products.length > 0 &&
                  products.every((product) => selectedIds.includes(product.id))
                }
                onChange={(e) =>
                  onSelectionChange(
                    e.target.checked
                      ? [
                          ...new Set([
                            ...selectedIds,
                            ...products.map((product) => product.id),
                          ]),
                        ]
                      : selectedIds.filter(
                          (id) =>
                            !products.some((product) => product.id === id),
                        ),
                  )
                }
              />
            </th>
            <Th>{t("product")}</Th>
            <Th>{t("reference")}</Th>
            <Th>{t("barcode")}</Th>
            <Th>{t("category")}</Th>
            <Th>{t("unit")}</Th>
            <Th>{t("sellingPrice")}</Th>
            <Th>{t("tracking")}</Th>
            <Th>{t("stock")}</Th>
            <Th>{t("status")}</Th>
            <Th right>{t("action")}</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan="11"
                className="h-[130px] text-center text-[13px] text-black/50"
              >
                {t("loadingProducts")}
              </td>
            </tr>
          ) : !products.length ? (
            <tr>
              <td colSpan="11" className="h-[180px] text-center">
                <Package size={24} className="mx-auto text-black/35" />
                <p className="mt-3 text-[13px] font-semibold">
                  {t(hasFilters ? "noMatchingProducts" : "noProducts")}
                </p>
              </td>
            </tr>
          ) : (
            products.map((product) => (
              <tr
                key={product.id}
                className="h-[48px] border-b border-gray-200"
              >
                <td className="px-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={(e) =>
                      onSelectionChange(
                        e.target.checked
                          ? [...selectedIds, product.id]
                          : selectedIds.filter((id) => id !== product.id),
                      )
                    }
                  />
                </td>
                <td className="px-5 text-[13px] font-semibold">
                  <div className="flex items-center gap-2">
                    {imagesEnabled && product.image_data && <img src={product.image_data} alt="" className="h-8 w-8 shrink-0 border border-gray-200 object-cover" />}
                    <span>{product.designation}</span>
                  </div>
                </td>
                <Td>{product.reference || "-"}</Td>
                <Td>
                  {product.primary_barcode
                    ? `${product.primary_barcode}${product.barcode_count > 1 ? ` +${product.barcode_count - 1}` : ""}`
                    : "-"}
                </Td>
                <Td>{product.category_name || "-"}</Td>
                <Td>
                  {product.unit_is_builtin
                    ? "-"
                    : product.unit_symbol || product.unit_name || "-"}
                  {product.package_count > 1 && (
                    <span className="ms-1 text-[10px] text-black/45">
                      +{product.package_count - 1}
                    </span>
                  )}
                </Td>
                <Td>
                  {formatMoney(product.selling_price)}
                </Td>
                <Td>
                  <Tracking product={product} t={t} />
                </Td>
                <Td>
                  {product.track_stock ? (
                    <StockValue
                      value={product.stock_quantity}
                      min={product.min_stock}
                      t={t}
                    />
                  ) : (
                    <span className="text-[11px] text-black/50">
                      {t("notTracked")}
                    </span>
                  )}
                </Td>
                <td className="px-4">
                  <span
                    className={`inline-flex h-[26px] items-center border px-2 text-[11px] font-semibold ${product.is_active ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 bg-gray-100 text-black/55"}`}
                  >
                    {t(product.is_active ? "active" : "inactive")}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 text-right rtl:text-left">
                  <div className="inline-flex items-center gap-2">
                    <button type="button" disabled={!product.primary_barcode} onClick={() => onPrint(product)} title={product.primary_barcode ? t("printLabels") : t("Aucun code-barres")} className="inline-flex h-[30px] items-center justify-center border border-gray-400 px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-black/30 disabled:opacity-60">
                      <Printer size={15} />
                    </button>
                    <button type="button" onClick={() => onDelete(product)} title={t("delete")} className="inline-flex h-[30px] items-center justify-center border border-red-400 px-3 text-[11px] font-semibold text-red-700 hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                    <button type="button" onClick={() => onEdit(product.id)} className="inline-flex h-[30px] items-center justify-center border border-gray-400 px-3 text-[11px] font-semibold">
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(product)}
                      className={`inline-flex h-[30px] items-center justify-center border px-3 text-[11px] font-semibold ${product.is_active ? "border-red-300 text-red-700" : "border-green-300 text-green-700"}`}
                    >
                      {t(product.is_active ? "deactivate" : "activate")}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
function Tracking({ product, t }) {
  const key = product.track_serials
    ? "trackSerials"
    : product.track_expiration
      ? "trackExpiration"
      : product.track_batches
        ? "trackBatches"
        : product.track_stock
          ? "trackStock"
          : "notTracked";
  return (
    <span className="text-[11px] font-semibold text-black/60">{t(key)}</span>
  );
}

function StockValue({ value, min, t }) {
  const quantity = Number(value);
  const state =
    quantity <= 0 ? "out" : quantity <= Number(min) ? "low" : "normal";
  return (
    <span
      className={`text-[12px] font-semibold ${state === "out" ? "text-red-700" : state === "low" ? "text-amber-700" : "text-black"}`}
    >
      {quantity}{" "}
      {state !== "normal" && (
        <span className="ms-1 text-[10px]">
          {t(state === "out" ? "outOfStock" : "lowStock")}
        </span>
      )}
    </span>
  );
}
