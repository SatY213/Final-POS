import { useEffect, useMemo, useRef, useState } from "react";
import { Filter as FilterIcon, RotateCcw, Search, X } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import Button from "./Button";

export default function DocumentFilters({ filters, onChange, onReset, placeholder, statuses = [] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const searchRef = useRef(null);
  const count = useMemo(
    () => [filters.from, filters.to, filters.status].filter(Boolean).length,
    [filters.from, filters.to, filters.status],
  );

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "F6") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "F1" && !open) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const reset = () => {
    onReset();
    setOpen(false);
  };
  const apply = () => {
    onChange({ ...draft, page: 1 });
    setOpen(false);
  };

  return <>
    <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 p-4">
      <div className="relative min-w-0 flex-1">
        <Search size={16} className="absolute start-3 top-[13px] text-black/45" />
        <input ref={searchRef} value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value, page: 1 })} placeholder={placeholder} className="h-[42px] w-full border border-gray-400 bg-white ps-9 pe-3 text-[12px] outline-none" />
      </div>
      <Button icon={FilterIcon} onClick={() => setOpen(true)}>{t("filters")}{count ? ` (${count})` : ""}<span className="ms-1 text-[10px] text-black/45">F6</span></Button>
      {count > 0 && <Button icon={RotateCcw} onClick={onReset}>{t("reset")}</Button>}
    </div>
    {count > 0 && <div className="flex min-h-9 flex-wrap gap-2 border-b border-gray-200 px-4 py-2 text-[10px]">
      {filters.from && <Chip>{t("fromDate")} {filters.from}</Chip>}
      {filters.to && <Chip>{t("toDate")} {filters.to}</Chip>}
      {filters.status && <Chip>{statuses.find((item) => item.value === filters.status)?.label || filters.status}</Chip>}
    </div>}
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[620px] border border-gray-400 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <div><h2 className="text-[16px] font-bold">{t("advancedFilters")}</h2><p className="mt-1 text-[11px] text-black/50">{t("advancedFiltersDescription")}</p></div>
          <button onClick={() => setOpen(false)} className="icon-button"><X size={17} /></button>
        </header>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label={t("fromDate")}><input type="date" value={draft.from || ""} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className="h-[42px] w-full border border-gray-400 px-3 text-[12px]" /></Field>
          <Field label={t("toDate")}><input type="date" value={draft.to || ""} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className="h-[42px] w-full border border-gray-400 px-3 text-[12px]" /></Field>
          <Field label={t("status")} className="sm:col-span-2"><select value={draft.status || ""} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="h-[42px] w-full border border-gray-400 bg-white px-3 text-[12px]"><option value="">{t("allStatuses")}</option>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        </div>
        <footer className="flex justify-end gap-3 border-t border-gray-300 p-4"><Button icon={RotateCcw} onClick={reset}>{t("reset")}</Button><Button onClick={() => setOpen(false)}>{t("cancel")}</Button><Button variant="primary" onClick={apply}>{t("apply")}</Button></footer>
      </div>
    </div>}
  </>;
}

function Chip({ children }) {
  return <span className="border border-gray-300 bg-gray-50 px-2 py-1 font-semibold">{children}</span>;
}

function Field({ label, children, className = "" }) {
  return <label className={className}><span className="mb-2 block text-[11px] font-semibold">{label}</span>{children}</label>;
}
