import { useState } from "react";
import { Download } from "lucide-react";
import { exportData } from "../../api/data-exchange.model";
import { useLanguage } from "../../i18n/LanguageContext";
import Button from "../ui/Button";

export default function ExportButton({ entity, query = {}, onError, className = "" }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function download() {
    try {
      setBusy(true);
      await exportData(entity, query);
    } catch (error) {
      onError?.(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      icon={Download}
      className={className}
      disabled={busy}
      onClick={download}
    >
      {busy ? t("loading") : t("exportData")}
    </Button>
  );
}
