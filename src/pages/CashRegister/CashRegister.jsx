import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Eye,
  History,
  LockKeyhole,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import {
  closeCashSession,
  createCashMovement,
  getAvailableCashRegisters,
  getCashSession,
  getCashSessions,
  openCashSession,
} from "../../api/cash-session.model";
import { useLanguage } from "../../i18n/LanguageContext";

export default function CashRegister({
  session: auth,
  cashSession,
  warehouseId,
  onCashSessionChange,
}) {
  const { t, language } = useLanguage();
  const [current, setCurrent] = useState(cashSession);
  const [history, setHistory] = useState({
    cash_sessions: [],
    pagination: { page: 1, total_pages: 1 },
  });
  const [filters, setFilters] = useState({
    date: "",
    cash_register_id: "",
    user_id: "",
    status: "",
    page: 1,
    limit: 25,
  });
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isStock = auth?.user?.role === "stock";
  async function load() {
    if (isStock) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      setHistory(await getCashSessions(filters));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setCurrent(cashSession);
  }, [cashSession]);
  useEffect(() => {
    load();
  }, [filters, isStock]);
  function changed(next) {
    setCurrent(next);
    onCashSessionChange(next);
    load();
  }
  async function view(id) {
    try {
      setError("");
      setDetail(await getCashSession(id));
    } catch (err) {
      setError(err.message);
    }
  }
  const cash = (value) =>
    `${Number(value || 0).toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat(language, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(`${value.replace(" ", "T")}Z`))
      : "-";
  if (isStock)
    return (
      <Page>
        <div className="border border-gray-300 bg-white p-8 text-center text-[13px] text-black/55">
          {t("cashAccessDenied")}
        </div>
      </Page>
    );
  if (detail)
    return (
      <Page>
        <SessionDetail
          data={detail}
          cash={cash}
          date={date}
          t={t}
          onBack={() => setDetail(null)}
        />
      </Page>
    );
  return (
    <Page>
      <section className="border border-gray-300 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#087c1e]">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-[17px] font-bold">
                {t("cashRegisterModule")}
              </h1>
              <p className="mt-1 text-[12px] text-black/55">
                {t("cashRegisterModuleDescription")}
              </p>
            </div>
          </div>
          {!current && (
            <button onClick={() => setModal("open")} className="primary">
              <Plus size={17} />
              {t("openCashRegister")}
            </button>
          )}
        </div>
        {error && <Error message={error} />}{" "}
        {current ? (
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">
                {t("currentSession")}
              </h2>
              <span className="border border-green-300 bg-green-50 px-3 py-1 text-[11px] font-semibold text-green-700">
                {t("open")}
              </span>
            </div>
            <div className="grid border border-gray-300 sm:grid-cols-2 lg:grid-cols-7">
              <Info
                label={t("cashRegister")}
                value={current.cash_register_name}
              />
              <Info label={t("user")} value={current.user_name} />
              <Info label={t("openedAt")} value={date(current.opened_at)} />
              <Info
                label={t("openingFund")}
                value={cash(current.opening_cash)}
              />
              <Info
                label={t("manualCashIn")}
                value={cash(current.manual_in_total)}
              />
              <Info
                label={t("manualCashOut")}
                value={cash(current.manual_out_total)}
              />
              <Info
                label={t("theoreticalCash")}
                value={cash(current.expected_cash)}
                strong
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setModal("in")}
                className="secondary flex items-center gap-2"
              >
                <ArrowDownToLine size={16} className="text-green-700" />
                {t("cashIn")}
              </button>
              <button
                onClick={() => setModal("out")}
                className="secondary flex items-center gap-2"
              >
                <ArrowUpFromLine size={16} className="text-orange-700" />
                {t("cashOut")}
              </button>
              <button
                onClick={() => setModal("close")}
                className="flex h-10 items-center gap-2 border border-red-300 bg-red-50 px-4 text-[12px] font-semibold text-red-700"
              >
                <LockKeyhole size={16} />
                {t("closeRegister")}
              </button>
            </div>
            <MovementTable
              movements={current.movements || []}
              cash={cash}
              date={date}
              t={t}
            />
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <Wallet size={28} className="mx-auto text-black/35" />
            <h2 className="mt-3 text-[15px] font-semibold">
              {t("noOpenSession")}
            </h2>
            <p className="mt-2 text-[12px] text-black/50">
              {t("openSessionPrompt")}
            </p>
            <button
              onClick={() => setModal("open")}
              className="primary mx-auto mt-5"
            >
              <Plus size={17} />
              {t("openCashRegister")}
            </button>
          </div>
        )}
      </section>
      <section className="mt-4 border border-gray-300 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
          <History size={18} />
          <h2 className="text-[14px] font-semibold">{t("sessionHistory")}</h2>
        </div>
        <div className="grid gap-3 border-b border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <input
            type="date"
            value={filters.date}
            onChange={(e) =>
              setFilters({ ...filters, date: e.target.value, page: 1 })
            }
            className="input"
          />
          <select
            value={filters.cash_register_id}
            onChange={(e) =>
              setFilters({
                ...filters,
                cash_register_id: e.target.value,
                page: 1,
              })
            }
            className="input"
          >
            <option value="">{t("allCashRegisters")}</option>
            {unique(
              history.cash_sessions,
              "cash_register_id",
              "cash_register_name",
            ).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={filters.user_id}
            onChange={(e) =>
              setFilters({ ...filters, user_id: e.target.value, page: 1 })
            }
            className="input"
          >
            <option value="">{t("allUsers")}</option>
            {unique(history.cash_sessions, "user_id", "user_name").map(
              (item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ),
            )}
          </select>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value, page: 1 })
            }
            className="input"
          >
            <option value="">{t("allStatuses")}</option>
            <option value="open">{t("open")}</option>
            <option value="closed">{t("closed")}</option>
          </select>
        </div>
        <HistoryTable
          data={history.cash_sessions}
          loading={loading}
          cash={cash}
          date={date}
          t={t}
          onView={view}
        />
        <div className="flex justify-end gap-2 border-t border-gray-200 p-3">
          <button
            disabled={history.pagination.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            className="icon-button"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-20 py-2 text-center text-[11px]">
            {history.pagination.page} / {history.pagination.total_pages}
          </span>
          <button
            disabled={history.pagination.page >= history.pagination.total_pages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            className="icon-button"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </section>
      {modal && (
        <CashModal
          type={modal}
          session={current}
          warehouseId={warehouseId}
          cash={cash}
          t={t}
          onClose={() => setModal(null)}
          onChanged={(next) => {
            setModal(null);
            changed(next);
          }}
          onError={setError}
        />
      )}
    </Page>
  );
}

function CashModal({
  type,
  session,
  warehouseId,
  cash,
  t,
  onClose,
  onChanged,
  onError,
}) {
  const [registers, setRegisters] = useState([]),
    [registerId, setRegisterId] = useState(""),
    [amount, setAmount] = useState(type === "close" ? "" : ""),
    [note, setNote] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (type === "open")
      getAvailableCashRegisters(warehouseId)
        .then((items) => {
          setRegisters(items);
          if (items.length === 1) setRegisterId(String(items[0].id));
        })
        .catch((err) => setError(err.message));
  }, [type, warehouseId]);
  const title =
    type === "open"
      ? t("openCashRegister")
      : type === "in"
        ? t("cashIn")
        : type === "out"
          ? t("cashOut")
          : t("cashClosing");
  const difference =
    type === "close" && amount !== ""
      ? Number(amount) - Number(session.expected_cash)
      : 0;
  async function submit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      let next;
      if (type === "open")
        next = await openCashSession({
          cash_register_id: Number(registerId),
          warehouse_id: Number(warehouseId),
          opening_cash: Number(amount),
        });
      else if (type === "close")
        next = await closeCashSession(session.id, {
          closing_cash: Number(amount),
          closing_note: note,
        });
      else
        next = await createCashMovement(session.id, {
          direction: type === "in" ? "IN" : "OUT",
          amount: Number(amount),
          note,
        });
      onChanged(type === "close" ? null : next);
    } catch (err) {
      setError(err.message);
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-[620px] border border-gray-400 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-[16px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="icon-button">
            <X size={17} />
          </button>
        </div>
        {error && <Error message={error} />}
        <div className="space-y-4 p-5">
          {type === "open" && (
            <Field label={t("cashRegister")}>
              <select
                required
                value={registerId}
                onChange={(e) => setRegisterId(e.target.value)}
                className="input"
              >
                <option value="">
                  {registers.length
                    ? t("selectCashRegister")
                    : t("noAvailableRegisters")}
                </option>
                {registers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {type === "close" && (
            <div className="space-y-2 border border-gray-300 bg-gray-50 p-4">
              <Line
                label={t("openingFund")}
                value={cash(session.opening_cash)}
              />
              <Line
                label={t("manualCashIn")}
                value={cash(session.manual_in_total)}
              />
              <Line
                label={t("manualCashOut")}
                value={`-${cash(session.manual_out_total)}`}
              />
              <Line
                label={t("theoreticalCash")}
                value={cash(session.expected_cash)}
                strong
              />
            </div>
          )}
          <Field
            label={
              type === "open"
                ? t("openingFund")
                : type === "close"
                  ? t("countedCash")
                  : t("amount")
            }
          >
            <input
              required
              autoFocus
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
            />
          </Field>
          {type !== "open" && (
            <Field
              label={type === "close" ? t("closingNote") : t("reasonNote")}
            >
              <textarea
                required={type !== "close"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-20 w-full border border-gray-400 p-3 text-[12px] outline-none"
              />
            </Field>
          )}
          {type === "close" && amount !== "" && (
            <div
              className={`flex justify-between border p-3 text-[13px] font-semibold ${difference < 0 ? "border-orange-300 bg-orange-50 text-orange-800" : difference > 0 ? "border-blue-300 bg-blue-50 text-blue-800" : "border-green-300 bg-green-50 text-green-700"}`}
            >
              <span>{t("difference")}</span>
              <span>
                {difference > 0 ? "+" : ""}
                {cash(difference)}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-300 p-4">
          <button type="button" onClick={onClose} className="secondary">
            {t("cancel")}
          </button>
          <button
            disabled={saving || (type === "open" && !registerId)}
            className="primary"
          >
            {saving ? t("saving") : title}
          </button>
        </div>
      </form>
    </div>
  );
}
function MovementTable({ movements, cash, date, t }) {
  return (
    <div className="mt-5">
      <h3 className="mb-3 text-[13px] font-semibold">{t("cashMovements")}</h3>
      <div className="overflow-x-auto border border-gray-300">
        <table className="w-full text-left rtl:text-right">
          <thead>
            <tr className="h-10 bg-gray-50">
              <Th>{t("time")}</Th>
              <Th>{t("type")}</Th>
              <Th>{t("cashIn")}</Th>
              <Th>{t("cashOut")}</Th>
              <Th>{t("reasonNote")}</Th>
            </tr>
          </thead>
          <tbody>
            {!movements.length ? (
              <Empty cols="5" text={t("noCashMovements")} />
            ) : (
              movements.slice(0, 10).map((item) => (
                <tr key={item.id} className="h-11 border-t border-gray-200">
                  <Td>{date(item.created_at)}</Td>
                  <Td>{t(item.movement_type)}</Td>
                  <Td green>
                    {item.direction === "IN" ? `+${cash(item.amount)}` : "-"}
                  </Td>
                  <Td>{item.direction === "OUT" ? cash(item.amount) : "-"}</Td>
                  <Td>{item.note}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function HistoryTable({ data, loading, cash, date, t, onView }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-left rtl:text-right">
        <thead>
          <tr className="h-11 bg-gray-50">
            <Th>{t("date")}</Th>
            <Th>{t("cashRegister")}</Th>
            <Th>{t("user")}</Th>
            <Th>{t("openedAt")}</Th>
            <Th>{t("closedAt")}</Th>
            <Th>{t("openingFund")}</Th>
            <Th>{t("theoreticalCash")}</Th>
            <Th>{t("countedCash")}</Th>
            <Th>{t("difference")}</Th>
            <Th>{t("status")}</Th>
            <Th>{t("action")}</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <Empty cols="11" text={t("loading")} />
          ) : !data.length ? (
            <Empty cols="11" text={t("noSessions")} />
          ) : (
            data.map((item) => (
              <tr key={item.id} className="h-12 border-t border-gray-200">
                <Td>{date(item.opened_at)}</Td>
                <Td strong>{item.cash_register_name}</Td>
                <Td>{item.user_name}</Td>
                <Td>{date(item.opened_at)}</Td>
                <Td>{date(item.closed_at)}</Td>
                <Td>{cash(item.opening_cash)}</Td>
                <Td>{cash(item.expected_cash)}</Td>
                <Td>
                  {item.closing_cash == null ? "-" : cash(item.closing_cash)}
                </Td>
                <Td>
                  {item.closing_difference == null
                    ? "-"
                    : cash(item.closing_difference)}
                </Td>
                <Td>{t(item.status)}</Td>
                <Td>
                  <button
                    onClick={() => onView(item.id)}
                    className="icon-button"
                  >
                    <Eye size={15} />
                  </button>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
function SessionDetail({ data, cash, date, t, onBack }) {
  const s = data.cash_session;
  return (
    <section className="border border-gray-300 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 p-4">
        <button onClick={onBack} className="icon-button">
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="text-[16px] font-bold">{t("sessionDetail")}</h1>
          <p className="text-[12px] text-black/50">
            {s.cash_register_name} · {date(s.opened_at)}
          </p>
        </div>
      </div>
      <div className="grid border-b border-gray-200 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Info label={t("cashRegister")} value={s.cash_register_name} />
        <Info label={t("warehouse")} value={s.warehouse_name} />
        <Info label={t("user")} value={s.user_name} />
        <Info label={t("openedAt")} value={date(s.opened_at)} />
        <Info label={t("closedAt")} value={date(s.closed_at)} />
        <Info label={t("openingFund")} value={cash(s.opening_cash)} />
        <Info label={t("theoreticalCash")} value={cash(s.expected_cash)} />
        <Info
          label={t("countedCash")}
          value={s.closing_cash == null ? "-" : cash(s.closing_cash)}
        />
        <Info
          label={t("difference")}
          value={
            s.closing_difference == null ? "-" : cash(s.closing_difference)
          }
          strong
        />
      </div>
      <div className="p-5">
        <MovementTable
          movements={data.movements}
          cash={cash}
          date={date}
          t={t}
        />
      </div>
    </section>
  );
}
function Page({ children }) {
  return (
    <div className="h-full overflow-auto bg-[#f5f7f5] p-6">
      <div className="mx-auto max-w-[1500px]">{children}</div>
    </div>
  );
}
function Info({ label, value, strong }) {
  return (
    <div className="min-w-0 border-b border-e border-gray-200 p-4">
      <p className="text-[10px] font-semibold uppercase text-black/45">
        {label}
      </p>
      <p
        className={`mt-2 truncate text-[12px] ${strong ? "font-bold" : "font-semibold"}`}
      >
        {value}
      </p>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label>
      <span className="mb-2 block text-[12px] font-semibold">{label}</span>
      {children}
    </label>
  );
}
function Line({ label, value, strong }) {
  return (
    <div
      className={`flex justify-between text-[12px] ${strong ? "border-t border-gray-300 pt-2 font-bold" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
function Error({ message }) {
  return (
    <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-[12px] text-red-700">
      {message}
    </div>
  );
}
function Th({ children }) {
  return <th className="px-4 text-[11px] font-semibold">{children}</th>;
}
function Td({ children, strong, green }) {
  return (
    <td
      className={`px-4 text-[11px] ${strong ? "font-semibold" : ""} ${green ? "text-green-700" : ""}`}
    >
      {children}
    </td>
  );
}
function Empty({ cols, text }) {
  return (
    <tr>
      <td colSpan={cols} className="h-28 text-center text-[12px] text-black/45">
        {text}
      </td>
    </tr>
  );
}
function unique(items, idKey, labelKey) {
  return [
    ...new Map(
      items.map((item) => [
        item[idKey],
        { id: item[idKey], label: item[labelKey] },
      ]),
    ).values(),
  ];
}
