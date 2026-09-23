import { useEffect, useRef, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { inputClass } from "../../components/ui/FormField";
import { formatMoney } from "../../utils/formatters";
import { calculateCheckoutPayment } from "../../utils/posPayment";
const Field = ({ label, children }) => (
  <label className="block text-[11px] font-semibold">
    <span className="mb-1 block">{label}</span>
    {children}
  </label>
);
export function DiscountDialog({
  open,
  title,
  discount,
  onClose,
  onConfirm,
  maximum,
  t,
}) {
  const [value, setValue] = useState(0),
    [type, setType] = useState("PERCENT");
  useEffect(() => {
    setType(discount?.type || "PERCENT");
    setValue(discount?.value || 0);
  }, [open, discount]);
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button
            variant="primary"
            onClick={() => onConfirm({ type, value: Number(value) })}
          >
            {t("confirm")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_130px] gap-3 p-5">
        <Field label={t("discountValue")}>
          <input
            autoFocus
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("discountType")}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            <option value="PERCENT">%</option>
            <option value="FIXED">DA</option>
          </select>
        </Field>
        <p className="col-span-2 text-[10px] text-black/50">
          {t("maximumDiscount")}: {maximum}%
        </p>
      </div>
    </Modal>
  );
}

export function SerialSelectionDialog({
  open,
  product,
  serials,
  loading,
  saving,
  error,
  onClose,
  onSelect,
  onAdd,
  t,
  emptyHint,
  hideEmptyNotice = false,
  creationOnly = false,
  bulkCreation = false,
  onAddMany,
  onConfirmSerials,
}) {
  const [selectedId, setSelectedId] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [bulkSerials, setBulkSerials] = useState([]);
  const [bulkError, setBulkError] = useState("");
  useEffect(() => {
    if (open) {
      setSelectedId("");
      setNewSerial("");
      setBulkSerials([]);
      setBulkError("");
    }
  }, [open, product?.product_id]);
  async function addBulkSerial() {
    const value = newSerial.trim();
    if (!value || saving) return;
    if (bulkSerials.some((serial) => serial.serial_number.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setBulkError(t("serialNumberAlreadyAdded"));
      return;
    }
    try {
      const added = await onAddMany([value]);
      setBulkSerials((current) => [...current, ...added]);
      setNewSerial("");
      setBulkError("");
    } catch (addError) {
      setBulkError(addError.message || t("serialNumberAddFailed"));
    }
  }
  return (
    <Modal
      open={open}
      title={t("selectSerialNumber")}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button
            variant="primary"
            disabled={bulkCreation ? !bulkSerials.length : (!selectedId || loading || saving)}
            onClick={() => bulkCreation ? onConfirmSerials?.(bulkSerials) : onSelect(Number(selectedId))}
          >
            {t("addToCart")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <div className="border border-gray-200 bg-gray-50 p-3">
          <b className="block text-[13px]">{product?.designation}</b>
          <span className="text-[11px] text-black/55">{product?.reference}</span>
        </div>
        {(error || bulkError) && (
          <div className="border border-red-300 bg-red-50 p-3 text-[11px] font-semibold text-red-700">
            {error || bulkError}
          </div>
        )}
        {!creationOnly && <Field label={t("availableSerialNumbers")}>
          <select
            autoFocus
            value={selectedId}
            disabled={loading}
            onChange={(event) => setSelectedId(event.target.value)}
            className={inputClass}
          >
            <option value="">
              {loading ? t("loading") : t("selectSerialNumber")}
            </option>
            {serials.map((serial) => (
              <option key={serial.id} value={serial.id}>
                {serial.serial_number}
              </option>
            ))}
          </select>
        </Field>}
        {!creationOnly && !loading && !serials.length && !hideEmptyNotice && (
          <p className="text-[11px] text-amber-700">{emptyHint || t("noAvailableSerialNumbers")}</p>
        )}
        {bulkCreation ? <div className="border-t border-gray-200 pt-4">
          <Field label={t("addNewSerialNumber")}>
            <div className="flex gap-2">
              <input autoFocus value={newSerial} onChange={(event) => setNewSerial(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addBulkSerial(); } }} className={inputClass} placeholder={t("serialNumber")}/>
              <Button disabled={!newSerial.trim() || saving} onClick={addBulkSerial}>{t("add")}</Button>
            </div>
          </Field>
          {!!bulkSerials.length && <div className="mt-3 border border-gray-200"><div className="border-b bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase text-black/50">{bulkSerials.length} {t("numéro(s) ajouté(s)")}</div>{bulkSerials.map((serial) => <div key={serial.id} className="flex items-center justify-between border-b px-3 py-2 text-[12px] last:border-b-0"><span>{serial.serial_number}</span><button type="button" className="text-red-700" onClick={() => setBulkSerials((current) => current.filter((item) => item.id !== serial.id))}>×</button></div>)}</div>}
        </div> : <div className="border-t border-gray-200 pt-4">
          <Field label={t("addNewSerialNumber")}>
            <div className="flex gap-2">
              <input
                autoFocus={creationOnly}
                value={newSerial}
                onChange={(event) => setNewSerial(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newSerial.trim()) {
                    event.preventDefault();
                    onAdd(newSerial.trim()).then((serial) => {
                      if (serial) {
                        setSelectedId(String(serial.id));
                        setNewSerial("");
                      }
                    });
                  }
                }}
                className={inputClass}
                placeholder={t("serialNumber")}
              />
              <Button
                disabled={!newSerial.trim() || saving}
                onClick={() =>
                  onAdd(newSerial.trim()).then((serial) => {
                    if (serial) {
                      setSelectedId(String(serial.id));
                      setNewSerial("");
                    }
                  })
                }
              >
                {t("add")}
              </Button>
            </div>
          </Field>
        </div>}
      </div>
    </Modal>
  );
}

export function BatchSelectionDialog({
  open,
  product,
  batches,
  loading,
  error,
  onClose,
  onSelect,
  t,
}) {
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    if (open) setSelectedId("");
  }, [open, product?.product_id]);
  const selected = batches.find((batch) => Number(batch.id) === Number(selectedId));
  return (
    <Modal
      open={open}
      title={t("batchLot")}
      onClose={onClose}
      width="sm"
      footer={<><Button onClick={onClose}>{t("cancel")}</Button><Button variant="primary" disabled={!selected || loading} onClick={() => onSelect(selected)}>{t("addToCart")}</Button></>}
    >
      <div className="space-y-4 p-5">
        <div className="border border-gray-200 bg-gray-50 p-3">
          <b className="block text-[13px]">{product?.designation}</b>
          <span className="text-[11px] text-black/55">{product?.reference}</span>
        </div>
        {error && <div className="border border-red-300 bg-red-50 p-3 text-[11px] font-semibold text-red-700">{error}</div>}
        <Field label={t("batchLot")}>
          <select autoFocus value={selectedId} disabled={loading} onChange={(event) => setSelectedId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && selected) { event.preventDefault(); onSelect(selected); } }} className={inputClass}>
            <option value="">{loading ? t("loading") : t("batchLot")}</option>
            {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_number || "—"} · {batch.quantity} {product?.unit_name}{batch.expiration_date ? ` · ${batch.expiration_date}` : ""}</option>)}
          </select>
        </Field>
        {!loading && !batches.length && <p className="text-[11px] text-amber-700">{t("Aucun lot disponible.")}</p>}
      </div>
    </Modal>
  );
}
export function ArticleEditor({
  open,
  line,
  units,
  focus,
  settings,
  onClose,
  onConfirm,
  language,
  t,
  unitPriceKey = "selling_price",
  showStock = true,
  showPurchaseTracking = false,
}) {
  const [form, setForm] = useState(line || {}),
    [serialInput, setSerialInput] = useState(""),
    [serialInputError, setSerialInputError] = useState(""),
    quantityRef = useRef(),
    unitRef = useRef(),
    priceRef = useRef(),
    discountRef = useRef();
  useEffect(() => {
    if (!open) return;
    setForm({
      ...line,
      discount_type: line.discount_type || "PERCENT",
      discount_value: line.discount_value ?? line.discount_percent ?? 0,
    });
    setSerialInput("");
    setSerialInputError("");
    setTimeout(() => {
      const target = {
        quantity: quantityRef,
        unit: unitRef,
        unit_price: priceRef,
        discount: discountRef,
        discount_percent: discountRef,
      }[focus || "quantity"]?.current;
      target?.focus();
      target?.select?.();
    }, 0);
  }, [open, line, focus]);
  const subtotal = Number(form.quantity || 0) * Number(form.unit_price || 0),
    discountAmount =
      form.discount_type === "FIXED"
        ? Number(form.discount_value || 0)
        : (subtotal * Number(form.discount_value || 0)) / 100,
    net = Math.max(0, subtotal - discountAmount),
    total = net,
    insufficient =
      form.track_stock &&
      Number(form.stock_quantity) <
        Number(form.quantity) * Number(form.conversion_factor);
  function chooseUnit(id) {
    const unit = units.find(
      (item) => Number(item.product_unit_id) === Number(id),
    );
    if (unit)
      setForm({
        ...form,
        product_unit_id: unit.product_unit_id,
        unit_name: unit.unit_name,
        conversion_factor: unit.conversion_factor,
        unit_price: unit[unitPriceKey] ?? unit.unit_price,
        barcode: unit.barcode,
      });
  }
  function addPurchaseSerial() {
    const value = serialInput.trim();
    if (!value) return;
    const current = form.serial_numbers || [];
    if (current.some((serial) => String(serial).toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setSerialInputError(t("serialNumberAlreadyAdded"));
      return;
    }
    const serial_numbers = [...current, value];
    setForm({ ...form, serial_numbers, quantity: serial_numbers.length });
    setSerialInput("");
    setSerialInputError("");
  }
  return (
    <Modal
      open={open}
      title={t("editItem")}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button variant="primary" onClick={() => onConfirm(form)}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <div
        className="space-y-4 p-5"
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target.tagName !== "SELECT") {
            event.preventDefault();
            onConfirm(form);
          }
        }}
      >
        <div>
          <b className="text-[14px]">{form.designation}</b>
          {form.reference && (
            <p className="mt-1 text-[10px] text-black/50">{form.reference}</p>
          )}
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center gap-3 text-[11px]">
          <span className="font-semibold">{t("quantity")}</span>
          <div className="flex">
            <button
              disabled={form.track_serials}
              onClick={() =>
                setForm({
                  ...form,
                  quantity: Math.max(0.001, Number(form.quantity) - 1),
                })
              }
              className="h-[42px] w-10 border border-gray-400 border-r-0"
            >
              -
            </button>
            <input
              ref={quantityRef}
              type="number"
              disabled={form.track_serials}
              min=".001"
              step=".001"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className={`${inputClass} text-center`}
            />
            <button
              disabled={form.track_serials}
              onClick={() =>
                setForm({ ...form, quantity: Number(form.quantity) + 1 })
              }
              className="h-[42px] w-10 border border-gray-400 border-l-0"
            >
              +
            </button>
          </div>
          <span className="font-semibold">{t("unit")}</span>
          <select
            ref={unitRef}
            value={form.product_unit_id || ""}
            disabled={!form.product_id || units.length < 2}
            onChange={(e) => chooseUnit(e.target.value)}
            className={inputClass}
          >
            {form.product_id ? (
              units.map((unit) => (
                <option key={unit.product_unit_id} value={unit.product_unit_id}>
                  {unit.unit_name} (x{unit.conversion_factor})
                </option>
              ))
            ) : (
              <option value="">{form.unit_name}</option>
            )}
          </select>
          <span className="font-semibold">{t("unitPriceHT")}</span>
          {!settings.allow_price_edit && form.line_type === "PRODUCT" ? (
            <b className="text-right text-[12px]">
              {formatMoney(form.unit_price, language)}
            </b>
          ) : (
            <input
              ref={priceRef}
              type="number"
              min="0"
              step=".01"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              className={inputClass}
            />
          )}
          {settings.allow_discount && (
            <>
              <span className="font-semibold">{t("discount")}</span>
              <div className="flex">
                <input
                  ref={discountRef}
                  type="number"
                  min="0"
                  step=".01"
                  value={form.discount_value}
                  onChange={(e) =>
                    setForm({ ...form, discount_value: e.target.value })
                  }
                  className={inputClass}
                />
                <select
                  value={form.discount_type}
                  onChange={(e) =>
                    setForm({ ...form, discount_type: e.target.value })
                  }
                  className="w-20 border border-gray-400 border-l-0 bg-white px-2 h-[42px]"
                >
                  <option value="PERCENT">%</option>
                  <option value="FIXED">DA</option>
                </select>
              </div>
            </>
          )}
        </div>
        {showPurchaseTracking && Boolean(form.track_batches) && (
          <div className="grid grid-cols-[120px_1fr] items-center gap-3 text-[11px]">
            <span className="font-semibold">{t("batchLot")}</span>
            <input
              value={form.batch_number || ""}
              onChange={(event) =>
                setForm({ ...form, batch_number: event.target.value })
              }
              className={inputClass}
            />
            {Boolean(form.track_expiration) && (
              <>
                <span className="font-semibold">{t("expirationDate")}</span>
                <input
                  type="date"
                  value={form.expiration_date || ""}
                  onChange={(event) =>
                    setForm({ ...form, expiration_date: event.target.value })
                  }
                  className={inputClass}
                />
              </>
            )}
          </div>
        )}
        {showPurchaseTracking && Boolean(form.track_serials) && (
          <div className="space-y-2 text-[11px]">
            <span className="font-semibold">{t("serialNumbers")}</span>
            <div className="flex gap-2">
              <input value={serialInput} onChange={(event) => setSerialInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); addPurchaseSerial(); } }} className={inputClass} placeholder={t("serialNumber")}/>
              <Button onClick={addPurchaseSerial} disabled={!serialInput.trim()}>{t("add")}</Button>
            </div>
            {serialInputError && <p className="text-red-700">{serialInputError}</p>}
            <div className="max-h-32 overflow-auto border border-gray-200">
              {(form.serial_numbers || []).map((serial) => <div key={serial} className="flex items-center justify-between border-b px-3 py-2 last:border-b-0"><span>{serial}</span><button type="button" className="text-red-700" onClick={() => { const serial_numbers = form.serial_numbers.filter((item) => item !== serial); setForm({ ...form, serial_numbers, quantity: serial_numbers.length }); }}>×</button></div>)}
            </div>
          </div>
        )}
        {showStock && Boolean(form.track_stock) && (
          <div
            className={`flex justify-between border p-3 text-[11px] ${insufficient ? "border-red-300 bg-red-50 text-red-700" : "border-gray-300 bg-gray-50"}`}
          >
            <span>{t("availableStock")}</span>
            <span className="text-right">
              <b>
                {Number(form.stock_quantity || 0) /
                  Number(form.conversion_factor || 1)}{" "}
                {form.unit_name}
              </b>
              {Number(form.conversion_factor || 1) !== 1 && (
                <small className="block text-black/50">
                  ({form.stock_quantity} {t("baseUnits")})
                </small>
              )}
            </span>
          </div>
        )}
        <div className="space-y-2 border-t border-gray-300 pt-4 text-[11px]">
          <div className="flex justify-between">
            <span>{t("amountHT")}</span>
            <b>{formatMoney(net, language)}</b>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-[10px] font-bold uppercase">
              {t("lineTotal")}
            </span>
            <b className="text-[24px]">{formatMoney(total, language)}</b>
          </div>
        </div>
      </div>
    </Modal>
  );
}
export function MiscDialog({ open, onClose, onAdd, t }) {
  const [form, setForm] = useState({});
  useEffect(() => {
    if (open)
      setForm({
        designation: "",
        line_type: "MISC",
        quantity: 1,
        unit_name: "Unit",
        unit_price: "",
        discount_type: "PERCENT",
        discount_value: 0,
      });
  }, [open]);
  return (
    <Modal
      open={open}
      title={t("addLine")}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button variant="primary" onClick={() => onAdd(form)}>
            {t("add")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 p-5">
        <Field label={t("type")}>
          <select
            value={form.line_type || "MISC"}
            onChange={(e) => setForm({ ...form, line_type: e.target.value })}
            className={inputClass}
          >
            <option value="MISC">{t("miscItem")}</option>
            <option value="SERVICE">{t("service")}</option>
          </select>
        </Field>
        <Field label={t("designation")}>
          <input
            autoFocus
            value={form.designation || ""}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t("quantity")}>
          <input
            type="number"
            min=".001"
            step=".001"
            value={form.quantity || 1}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t("unit")}>
          <input
            value={form.unit_name || ""}
            onChange={(e) => setForm({ ...form, unit_name: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t("unitPrice")}>
          <input
            type="number"
            min="0"
            step=".01"
            value={form.unit_price || ""}
            onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t("discount")}>
          <div className="flex">
            <input
              type="number"
              min="0"
              step=".01"
              value={form.discount_value || 0}
              onChange={(e) =>
                setForm({ ...form, discount_value: e.target.value })
              }
              className={inputClass}
            />
            <select
              value={form.discount_type}
              onChange={(e) =>
                setForm({ ...form, discount_type: e.target.value })
              }
              className="w-20 border border-gray-400"
            >
              <option value="PERCENT">%</option>
              <option value="FIXED">DA</option>
            </select>
          </div>
        </Field>
      </div>
    </Modal>
  );
}
export function PaymentDialog({
  open,
  total,
  methods,
  settings,
  onClose,
  onConfirm,
  saving,
  language,
  t,
  customer,
  supplierMode = false,
}) {
  const [payments, setPayments] = useState([]),
    [useBalance, setUseBalance] = useState(false),
    receivedRef = useRef();
  useEffect(() => {
    if (open) {
      const code = settings?.default_method || methods[0]?.code || "";
      setPayments([
        { code, amount: total, amount_received: total, reference: "" },
      ]);
      setUseBalance(false);
      setTimeout(() => receivedRef.current?.focus(), 50);
    }
  }, [open, total]);
  const update = (i, patch) =>
      setPayments((rows) =>
        rows.map((row, index) => (index === i ? { ...row, ...patch } : row)),
      ),
    first = payments[0] || {},
    firstMethod = methods.find((method) => method.code === first.code),
    realCustomer =
      customer && customer.name?.toLocaleLowerCase() !== "client comptoir",
    availableBalance = realCustomer
      ? Math.max(0, -Number(customer?.account_balance || 0))
      : 0,
    balanceUsed = useBalance ? Math.min(availableBalance, total) : 0,
    calculation = calculateCheckoutPayment({
      total,
      balanceUsed,
      method: supplierMode ? { ...firstMethod, allows_change: false } : firstMethod,
      amount: first.amount,
      amountReceived: first.amount_received,
    }),
    payableTotal = calculation.payableTotal,
    received = calculation.received,
    paid = calculation.paid,
    remaining = calculation.remaining,
    valid = supplierMode
      ? Number(first.amount) >= 0 && Number(first.amount) <= total
      : remaining <= 0 || realCustomer,
    confirm = () =>
      onConfirm(
        paid > 0
          ? [
              {
                ...first,
                amount: paid,
                amount_received: firstMethod?.allows_change ? received : paid,
              },
            ]
          : [],
        { customer_credit_used: balanceUsed },
      ),
    change = calculation.change;
  return (
    <Modal
      open={open}
      title={t("payment")}
      onClose={onClose}
      width="lg"
      footer={
        <>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button
            variant="primary"
            disabled={saving || !valid}
            onClick={() => confirm()}
          >
            {saving ? t("processingSale") : supplierMode ? t("validateReceipt") : t("finalizeSale")}
          </Button>
        </>
      }
    >
      <div
        className="p-5"
        onKeyDown={(event) => {
          if (event.key === "Enter" && valid) {
            event.preventDefault();
            confirm();
          }
        }}
      >
        <div className="border-b border-gray-300 pb-4 text-center">
          <p className="text-[11px] font-bold uppercase">{t("totalDue")}</p>
          <p className="mt-1 text-[38px] font-black">
            {formatMoney(total, language)}
          </p>
        </div>
        {availableBalance > 0 && (
          <label className="mt-4 flex items-center justify-between border border-green-300 bg-green-50 p-3 text-[12px]">
            <span>
              {t("Solde client disponible :")}{" "}
              {formatMoney(availableBalance, language)}
            </span>
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useBalance}
                onChange={(event) => {
                  const checked = event.target.checked,
                    used = checked ? Math.min(availableBalance, total) : 0,
                    nextTotal = Math.max(
                      0,
                      Math.round((total - used) * 100) / 100,
                    );
                  setUseBalance(checked);
                  setPayments((rows) =>
                    rows.map((row, index) =>
                      index === 0
                        ? {
                            ...row,
                            amount: nextTotal,
                            amount_received: nextTotal,
                          }
                        : row,
                    ),
                  );
                }}
              />
              {t("Utiliser")}
            </span>
          </label>
        )}
        {
          <div className="space-y-4 pt-4">
            <Field label={t("paymentMethod")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {methods.map((method) => (
                  <button
                    key={method.code}
                    type="button"
                    onClick={() =>
                      update(0, {
                        code: method.code,
                        amount: payableTotal,
                        amount_received: payableTotal,
                      })
                    }
                    className={`h-10 border text-[11px] font-semibold ${first.code === method.code ? "border-green-600 bg-green-50 text-green-700" : "border-gray-400"}`}
                  >
                    {method.name}
                  </button>
                ))}
              </div>
            </Field>
            {firstMethod?.allows_change && !supplierMode ? (
              <>
                <Field label={t("amountReceived")}>
                  <div className="flex items-center">
                    <input
                      ref={receivedRef}
                      type="number"
                      min="0"
                      step=".01"
                      value={first.amount_received}
                      onChange={(e) =>
                        update(0, { amount_received: e.target.value })
                      }
                      className={`${inputClass} text-right text-[18px] font-bold`}
                    />
                    <span className="ms-2 font-bold">DA</span>
                  </div>
                </Field>
                <div className="border border-green-300 bg-green-50 p-4 text-right">
                  <span className="text-[10px] font-bold uppercase">
                    {t("changeDue")}
                  </span>
                  <p className="mt-1 text-[27px] font-black text-green-700">
                    {formatMoney(change, language)}
                  </p>
                </div>
              </>
            ) : (
              <Field label={t("amount")}>
                <input
                  ref={receivedRef}
                  type="number"
                  min="0"
                  max={payableTotal}
                  step=".01"
                  value={first.amount}
                  onChange={(event) =>
                    update(0, { amount: event.target.value })
                  }
                  className={`${inputClass} text-right text-[18px] font-bold`}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3 border-t border-gray-300 pt-3 text-[12px]">
              <div>
                <span className="block text-[10px] font-bold uppercase text-black/50">
                  {t("paid")}
                </span>
                <b>{formatMoney(paid, language)}</b>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold uppercase text-black/50">
                  {supplierMode ? t("supplierRemaining") : t("Reste client")}
                </span>
                <b
                  className={remaining > 0 ? "text-red-700" : "text-green-700"}
                >
                  {formatMoney(remaining, language)}
                </b>
              </div>
            </div>
            {remaining > 0 && realCustomer && (
              <p className="border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800">
                {formatMoney(remaining, language)} {t("seront ajoutés au solde dû du client.")}
              </p>
            )}
            {remaining > 0 && !realCustomer && !supplierMode && (
              <p className="border border-red-300 bg-red-50 p-3 text-[11px] text-red-700">
                {t("Sélectionnez un client pour laisser un solde impayé.")}
              </p>
            )}
          </div>
        }
      </div>
    </Modal>
  );
}
export function CashMovementDialog({
  open,
  direction,
  session,
  onClose,
  onConfirm,
  saving,
  language,
  t,
}) {
  const [amount, setAmount] = useState(""),
    [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
    }
  }, [open]);
  return (
    <Modal
      open={open}
      title={direction === "IN" ? t("cashIn") : t("cashOut")}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button
            variant="primary"
            disabled={saving || !Number(amount) || !note.trim()}
            onClick={() =>
              onConfirm({ direction, amount: Number(amount), note })
            }
          >
            {t("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Field label={t("amount")}>
          <input
            autoFocus
            type="number"
            min=".01"
            step=".01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("reasonNote")}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-20 w-full border border-gray-400 p-3 text-[12px]"
          />
        </Field>
        {direction === "OUT" && (
          <div className="flex justify-between border border-gray-300 bg-gray-50 p-3 text-[11px]">
            <span>{t("theoreticalCash")}</span>
            <b>{formatMoney(session?.expected_cash, language)}</b>
          </div>
        )}
      </div>
    </Modal>
  );
}
