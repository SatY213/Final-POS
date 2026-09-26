import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import ErrorMessage from "../ui/ErrorMessage";
import { commitImport, downloadImportTemplate, previewImport } from "../../api/data-exchange.model";
import { useLanguage } from "../../i18n/LanguageContext";

export default function DataExchangeDialog({
  open,
  entity,
  title,
  onClose,
  onImported,
  optionalSecondaryEntity = null,
}) {
  const { t } = useLanguage();
  const [file, setFile] = useState(null);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(null);
  const [policy, setPolicy] = useState("error");
  const [format, setFormat] = useState("csv");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [activeEntity, setActiveEntity] = useState(entity);
  const [includeSecondary, setIncludeSecondary] = useState(false);
  const [primarySummary, setPrimarySummary] = useState(null);
  const isSecondaryStep = Boolean(
    optionalSecondaryEntity && activeEntity === optionalSecondaryEntity,
  );

  useEffect(() => {
    if (!open) return;
    setActiveEntity(entity);
    setIncludeSecondary(false);
    setPrimarySummary(null);
  }, [open, entity]);

  async function choose(event) {
    const selected = event.target.files?.[0];
    setFile(selected || null);
    setPreview(null);
    setSummary(null);
    setError("");
    if (!selected) return setContent("");
    const extension = selected.name.toLocaleLowerCase().split(".").pop();
    if (!["csv", "sql"].includes(extension)) return setError(t("csvOrSqlOnly"));
    setFormat(extension);
    setContent(await selected.text());
  }

  async function inspect() {
    try {
      setBusy(true);
      setError("");
      setPreview(await previewImport(activeEntity, content, format));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    try {
      setBusy(true);
      setError("");
      const result = await commitImport(activeEntity, content, policy, format);
      setPreview(null);
      await onImported?.();
      if (
        optionalSecondaryEntity &&
        includeSecondary &&
        activeEntity === entity
      ) {
        setPrimarySummary(result);
        setActiveEntity(optionalSecondaryEntity);
        setFile(null);
        setContent("");
        setFormat("csv");
        return;
      }
      setSummary(result);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setFile(null);
    setContent("");
    setFormat("csv");
    setPreview(null);
    setSummary(null);
    setActiveEntity(entity);
    setIncludeSecondary(false);
    setPrimarySummary(null);
    setError("");
    onClose();
  }

  return (
    <Modal
      open={open}
      title={isSecondaryStep ? t("importInitialStock") : title}
      onClose={close}
      width="xl"
      footer={<><Button onClick={close}>{t("close")}</Button>{preview && !preview.error_count && <Button variant="primary" onClick={confirm} disabled={busy}>{t("confirmImport")}</Button>}</>}
    >
      <div className="space-y-4 p-5">
        <ErrorMessage message={error} onClose={() => setError("")} />
        {optionalSecondaryEntity && !isSecondaryStep && !summary && (
          <label className="flex cursor-pointer items-center gap-3 border border-gray-300 bg-gray-50 p-3 text-[12px] font-semibold">
            <input
              type="checkbox"
              checked={includeSecondary}
              onChange={(event) => setIncludeSecondary(event.target.checked)}
              className="h-4 w-4 accent-[#099323]"
            />
            {t("alsoImportInitialStock")}
          </label>
        )}
        {isSecondaryStep && primarySummary && (
          <div className="border border-green-300 bg-green-50 p-3 text-[12px] text-green-800">
            <b>{t("productsImported")}</b> {t("selectInitialStockFile")}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-4">
          <button onClick={() => downloadImportTemplate(activeEntity, "csv").catch((reason) => setError(reason.message))} className="flex min-h-20 items-center gap-3 border border-gray-300 p-4 text-left hover:bg-gray-50">
            <Download size={20} className="text-blue-600" />
            <span><b className="block text-[12px]">{t("downloadTemplate")}</b><small className="text-black/45">CSV UTF-8</small></span>
          </button>
          <button onClick={() => downloadImportTemplate(activeEntity, "sql").catch((reason) => setError(reason.message))} className="flex min-h-20 items-center gap-3 border border-gray-300 p-4 text-left hover:bg-gray-50">
            <Download size={20} className="text-purple-700" />
            <span><b className="block text-[12px]">{t("downloadTemplate")}</b><small className="text-black/45">{t("sqlInsertTemplate")}</small></span>
          </button>
          <label className="flex min-h-20 cursor-pointer items-center gap-3 border border-dashed border-gray-400 p-4 hover:bg-gray-50">
            <Upload size={20} className="text-green-700" />
            <span><b className="block text-[12px]">{file?.name || t("selectCsvOrSqlFile")}</b><small className="text-black/45">{file ? `${Math.round(file.size / 1024)} Ko · ${format.toUpperCase()}` : t("csvOrSqlPreviewBeforeImport")}</small></span>
            <input hidden type="file" accept=".csv,.sql,text/csv,application/sql,text/sql" onChange={choose} />
          </label>
          <label className="block border border-gray-300 p-3">
            <span className="mb-1 block text-[10px] font-bold uppercase text-black/45">{t("duplicateHandling")}</span>
            <select className="h-9 w-full border border-gray-400 px-2 text-[11px]" value={policy} onChange={(event) => setPolicy(event.target.value)}>
              <option value="error">{t("duplicateError")}</option>
              <option value="skip">{t("duplicateSkip")}</option>
              <option value="update">{t("duplicateUpdate")}</option>
            </select>
          </label>
        </div>
        {content && !preview && !summary && <Button variant="primary" icon={FileSpreadsheet} onClick={inspect} disabled={busy}>{t("validateAndPreview")}</Button>}
        {preview && <>
          <div className="grid grid-cols-3 gap-3"><Counter label={t("totalRows")} value={preview.total} /><Counter label={t("validRows")} value={preview.valid_count} good /><Counter label={t("invalidRows")} value={preview.error_count} bad /></div>
          <div className="max-h-[340px] overflow-auto border border-gray-300">
            <table className="w-full text-left text-[10px]"><thead className="sticky top-0 bg-gray-50"><tr className="h-9 border-b"><th className="px-3">#</th>{preview.columns.slice(0, 6).map((column) => <th key={column}>{column}</th>)}<th className="px-3">{t("errors")}</th></tr></thead>
              <tbody>{preview.rows.map((row) => <tr key={row.row_number} className={`h-9 border-b ${row.errors.length ? "bg-red-50" : ""}`}><td className="px-3">{row.row_number}</td>{preview.columns.slice(0, 6).map((column) => <td key={column} className="max-w-36 truncate pr-3">{String(row[column] ?? "")}</td>)}<td className="px-3 text-red-700">{row.errors.join(" · ")}</td></tr>)}</tbody>
            </table>
          </div>
        </>}
        {summary && <div className="border border-green-300 bg-green-50 p-5 text-[12px] text-green-800"><b className="block text-[14px]">{t("importCompleted")}</b><p className="mt-2">{t("created")}: {summary.created} · {t("updated")}: {summary.updated} · {t("ignored")}: {summary.skipped}</p></div>}
      </div>
    </Modal>
  );
}

function Counter({ label, value, good, bad }) {
  return <div className={`border p-3 ${good ? "border-green-300 bg-green-50" : bad ? "border-red-300 bg-red-50" : "border-gray-300"}`}><span className="text-[10px] font-semibold text-black/50">{label}</span><b className="mt-1 block text-[18px]">{value}</b></div>;
}
