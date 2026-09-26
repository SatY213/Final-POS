import { useState } from "react";
import { Download } from "lucide-react";
import { exportData } from "../../api/data-exchange.model";
import { useLanguage } from "../../i18n/LanguageContext";
import Button from "../ui/Button";

export default function ExportButton({
  entity,
  query = {},
  onError,
  className = "",
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState("sql");

  async function download() {
    try {
      setBusy(true);
      await exportData(entity, query, format);
    } catch (error) {
      onError?.(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`inline-flex ${className}`}>
      <Button icon={Download} disabled={busy} onClick={download}>
        {busy ? t("loading") : t("exportData")}
      </Button>
      <select
        aria-label={t("exportFormat")}
        className="h-10 border border-l-0 border-gray-400 bg-white px-2 text-[11px] font-semibold"
        value={format}
        onChange={(event) => setFormat(event.target.value)}
        disabled={busy}
      >
        {" "}
        <option value="sql">{t("sqlFormat")}</option>
        <option value="csv">{t("csvFormat")}</option>
      </select>
    </div>
  );
}
