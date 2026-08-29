import { useEffect, useState } from "react";
import { Package, Plus, Save, X } from "lucide-react";
import {
  createCategory,
  createProduct,
  createUnit,
  updateProduct,
} from "../../api/product.model";
import { useLanguage } from "../../i18n/LanguageContext";
import InitialStockEditor from "./components/InitialStockEditor";
import ProductUnitsEditor from "./components/ProductUnitsEditor";

const emptyForm = {
  designation: "",
  reference: "",
  category_id: "",
  description: "",
  tax_rate: "0",
  min_stock: "0",
  track_stock: true,
  track_batches: false,
  track_expiration: false,
  track_serials: false,
  is_active: true,
  product_units: [
    {
      unit_id: "",
      conversion_factor: "1",
      purchase_price: "0",
      selling_price: "0",
      is_base: true,
      is_active: true,
      barcodes: [],
    },
  ],
  initial_stock: [],
};

export default function ProductForm({
  product,
  categories,
  units,
  warehouses,
  activeWarehouseId,
  onLookupsChanged,
  onSaved,
  onCancel,
}) {
  const { t } = useLanguage();
  const editing = Boolean(product);
  const [form, setForm] = useState(emptyForm);
  const [showInitialStock, setShowInitialStock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(
      product
        ? {
            designation: product.designation || "",
            reference: product.reference || "",
            category_id: String(product.category_id || ""),
            description: product.description || "",
            tax_rate: String(product.tax_rate ?? 0),
            min_stock: String(product.min_stock ?? 0),
            track_stock: Boolean(product.track_stock),
            track_batches: Boolean(product.track_batches),
            track_expiration: Boolean(product.track_expiration),
            track_serials: Boolean(product.track_serials),
            is_active: Boolean(product.is_active),
            product_units:
              product.product_units?.map((item) => ({
                ...item,
                unit_id: item.is_base && item.unit_is_builtin ? "" : String(item.unit_id),
                conversion_factor: String(item.conversion_factor),
                purchase_price: String(item.purchase_price),
                selling_price: String(item.selling_price),
                is_base: Boolean(item.is_base),
                is_active: Boolean(item.is_active),
                barcodes:
                  item.barcodes?.map((code) => ({
                    ...code,
                    is_primary: Boolean(code.is_primary),
                  })) || [],
              })) || emptyForm.product_units,
            initial_stock: [],
          }
        : emptyForm,
    );
    setShowInitialStock(false);
    setError("");
  }, [product]);

  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => {
      const next = {
        ...current,
        [name]: type === "checkbox" ? checked : value,
      };
      if (name === "track_stock" && !checked) {
        next.track_batches = false;
        next.track_expiration = false;
        next.track_serials = false;
        next.initial_stock = [];
        setShowInitialStock(false);
      }
      if (name === "track_batches" && checked) next.track_stock = true;
      if (name === "track_batches" && !checked) next.track_expiration = false;
      if (name === "track_expiration" && checked) {
        next.track_stock = true;
        next.track_batches = true;
      }
      if (name === "track_serials" && checked) next.track_stock = true;
      if (["track_batches", "track_expiration"].includes(name))
        next.initial_stock = [];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (
      !form.designation.trim() ||
      !form.category_id ||
      form.product_units.some((item) => !item.is_base && !item.unit_id)
    ) {
      setError(t("productRequiredError"));
      return;
    }
    const productUnits = form.product_units.map((item) => ({
      ...item,
      unit_id: Number(item.unit_id),
      conversion_factor: Number(item.conversion_factor),
      purchase_price: Number(item.purchase_price),
      selling_price: Number(item.selling_price),
      barcodes: item.barcodes
        .filter((row) => row.barcode.trim())
        .map((row) => ({ ...row, barcode: row.barcode.trim() })),
    }));
    const cleanedBarcodes = productUnits.flatMap((item) => item.barcodes);
    if (
      new Set(cleanedBarcodes.map((row) => row.barcode)).size !==
      cleanedBarcodes.length
    ) {
      setError(t("duplicateBarcodeError"));
      return;
    }
    try {
      setSaving(true);
      setError("");
      const payload = {
        ...form,
        category_id: Number(form.category_id),
        tax_rate: Number(form.tax_rate),
        min_stock: Number(form.min_stock),
        product_units: productUnits,
        initial_stock: editing
          ? []
          : form.initial_stock.map((row) => ({
              ...row,
              warehouse_id: Number(row.warehouse_id),
              product_unit_index: Number(row.product_unit_index || 0),
              quantity: Number(row.quantity),
              purchase_price:
                row.purchase_price === "" ? null : Number(row.purchase_price),
            })),
      };
      const saved = editing
        ? await updateProduct(product.id, payload)
        : await createProduct(payload);
      await onSaved(saved);
    } catch (err) {
      setError(err.message || t("saveProductFailed"));
    } finally {
      setSaving(false);
    }
  }

  const activeCategories = categories.filter(
    (item) => item.is_active || Number(item.id) === Number(form.category_id),
  );
  const activeUnits = units.filter(
    (item) =>
      item.is_active ||
      form.product_units.some(
        (unit) => Number(unit.unit_id) === Number(item.id),
      ),
  );

  return (
    <form onSubmit={submit} className="border border-gray-300 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold">
              {t(editing ? "editProduct" : "addProduct")}
            </h1>
            <p className="mt-1 text-[12px] text-black/55">
              {t("productFormDescription")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          title={t("close")}
          className="flex h-[38px] w-[38px] items-center justify-center border border-gray-400"
        >
          <X size={18} />
        </button>
      </div>
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-[13px] font-medium text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-6 p-5">
        <FormSection title={t("generalInformation")}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Field
              label={t("designation")}
              name="designation"
              value={form.designation}
              onChange={change}
              required
            />
            <Field
              label={t("reference")}
              name="reference"
              value={form.reference}
              onChange={change}
            />
            <SelectWithAdd
              label={t("category")}
              name="category_id"
              value={form.category_id}
              onChange={change}
              options={activeCategories}
              onCreated={async (name) => {
                const item = await createCategory({ name });
                await onLookupsChanged();
                setForm((current) => ({
                  ...current,
                  category_id: String(item.id),
                }));
              }}
              addLabel={t("newCategory")}
            />
            <Field
              label={t("taxRate")}
              name="tax_rate"
              type="number"
              min="0"
              step="0.01"
              value={form.tax_rate}
              onChange={change}
            />
            <label className="lg:col-span-2">
              <span className="mb-2 block text-[12px] font-semibold">
                {t("description")}
              </span>
              <textarea
                name="description"
                value={form.description}
                onChange={change}
                rows="3"
                className="w-full resize-none border border-gray-400 px-3 py-2 text-[13px] outline-none"
              />
            </label>
          </div>
        </FormSection>
        <ProductUnitsEditor
          value={form.product_units}
          onChange={(product_units) =>
            setForm((current) => ({ ...current, product_units }))
          }
          units={activeUnits}
        />
        <FormSection title={t("inventoryConfiguration")}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Toggle
              label={t("trackStock")}
              description={t("trackStockDescription")}
              name="track_stock"
              checked={form.track_stock}
              onChange={change}
            />
            <Toggle
              label={t("trackBatches")}
              description={t("trackBatchesDescription")}
              name="track_batches"
              checked={form.track_batches}
              onChange={change}
            />
            <Toggle
              label={t("trackExpiration")}
              description={t("hasExpirationDescription")}
              name="track_expiration"
              checked={form.track_expiration}
              onChange={change}
            />
            <Toggle
              label={t("trackSerials")}
              description={t("trackSerialsDescription")}
              name="track_serials"
              checked={form.track_serials}
              onChange={change}
            />
            <Field
              label={t("minimumStock")}
              name="min_stock"
              type="number"
              min="0"
              step="0.01"
              value={form.min_stock}
              onChange={change}
              disabled={!form.track_stock}
            />
          </div>
        </FormSection>
        {!editing &&
          form.track_stock &&
          (!showInitialStock ? (
            <button
              type="button"
              onClick={() => setShowInitialStock(true)}
              className="flex h-[42px] items-center gap-2 border border-gray-400 px-4 text-[13px] font-semibold"
            >
              <Plus size={17} />
              {t("addInitialStock")}
            </button>
          ) : (
            <InitialStockEditor
              rows={form.initial_stock}
              onChange={(initial_stock) =>
                setForm((current) => ({ ...current, initial_stock }))
              }
              warehouses={warehouses}
              activeWarehouseId={activeWarehouseId}
              trackBatches={form.track_batches}
              trackExpiration={form.track_expiration}
              productUnits={form.product_units}
              units={units}
            />
          ))}
        <label className="flex items-center gap-3 border-t border-gray-200 pt-5">
          <input
            type="checkbox"
            name="is_active"
            checked={form.is_active}
            onChange={change}
            className="h-4 w-4"
          />
          <span>
            <span className="block text-[13px] font-semibold">
              {t("active")}
            </span>
            <span className="mt-1 block text-[11px] text-black/50">
              {t("productActiveDescription")}
            </span>
          </span>
        </label>
      </div>
      <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-[42px] border border-gray-400 px-5 text-[13px] font-semibold"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex h-[42px] items-center gap-2 border border-[#087c1e] bg-[#099323] px-5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          <Save size={17} />
          {saving ? t("saving") : t(editing ? "saveChanges" : "createProduct")}
        </button>
      </div>
    </form>
  );
}

function FormSection({ title, children }) {
  return (
    <section className="border-t border-gray-200 pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-4 text-[14px] font-bold">{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, required, ...props }) {
  return (
    <label>
      <span className="mb-2 block text-[12px] font-semibold">
        {label}
        {required && <span className="ms-1 text-red-600">*</span>}
      </span>
      <input
        {...props}
        required={required}
        className="h-[42px] w-full border border-gray-400 px-3 text-[13px] outline-none disabled:bg-gray-100 disabled:text-black/40"
      />
    </label>
  );
}
function Toggle({ label, description, ...props }) {
  return (
    <label
      className={`flex items-start gap-3 border border-gray-300 bg-gray-50 p-4 ${props.disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <input type="checkbox" {...props} className="mt-1 h-4 w-4" />
      <span>
        <span className="block text-[13px] font-semibold">{label}</span>
        <span className="mt-1 block text-[11px] text-black/50">
          {description}
        </span>
      </span>
    </label>
  );
}
function SelectWithAdd({
  label,
  options,
  optionLabel = (item) => item.name,
  onCreated,
  addLabel,
  symbol,
  ...props
}) {
  const { t } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [unitSymbol, setUnitSymbol] = useState("");
  const [error, setError] = useState("");
  async function add() {
    if (!name.trim() || (symbol && !unitSymbol.trim())) return;
    try {
      setError("");
      await onCreated(name.trim(), unitSymbol.trim());
      setName("");
      setUnitSymbol("");
      setAdding(false);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={props.name} className="text-[12px] font-semibold">
          {label}
          <span className="ms-1 text-red-600">*</span>
        </label>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          className="text-[11px] font-semibold text-[#087c1e]"
        >
          + {addLabel}
        </button>
      </div>
      <select
        {...props}
        id={props.name}
        required
        className="h-[42px] w-full border border-gray-400 bg-white px-3 text-[13px] outline-none"
      >
        <option value="">{t("selectOption")}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {optionLabel(item)}
          </option>
        ))}
      </select>
      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={label}
            className="h-9 min-w-0 flex-1 border border-gray-400 px-2 text-[12px] outline-none"
          />
          {symbol && (
            <input
              value={unitSymbol}
              onChange={(event) => setUnitSymbol(event.target.value)}
              placeholder={t("symbol")}
              className="h-9 w-20 border border-gray-400 px-2 text-[12px] outline-none"
            />
          )}
          <button
            type="button"
            onClick={add}
            className="h-9 border border-[#087c1e] bg-[#099323] px-3 text-[11px] font-semibold text-white"
          >
            {t("add")}
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
