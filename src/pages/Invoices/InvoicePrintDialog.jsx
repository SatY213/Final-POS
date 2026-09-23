import { useMemo } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import PrintPreviewCanvas from "../../components/printing/PrintPreviewCanvas";
import { buildCommercialPrintHtml } from "../../utils/commercialPrintTemplate";
import { useLanguage } from "../../i18n/LanguageContext";

export default function InvoicePrintDialog({ invoice, onClose, setError }) {
  const { t } = useLanguage();
  const profile = invoice?.print_profile || {
    paper_format: "A4",
    configuration: { title: "Facture" },
  };
  const html = useMemo(
    () => (invoice ? buildCommercialPrintHtml(invoice, profile) : ""),
    [invoice, profile],
  );
  async function print() {
    try {
      await window.electronAPI?.printDocument?.(invoice, profile);
      onClose();
    } catch (error) {
      setError?.(error.message);
    }
  }
  return (
    <Modal
      open={!!invoice}
      title={`${t("Prévisualisation")} · ${invoice?.invoice_number || ""}`}
      onClose={onClose}
      fullScreen
      footer={
        <>
          <Button onClick={onClose}>{t("Fermer")}</Button>
          <Button variant="primary" onClick={print}>
            {t("Imprimer directement")}
          </Button>
        </>
      }
    >
      <PrintPreviewCanvas html={html} format={profile.paper_format} title={t("Aperçu facture")} />
    </Modal>
  );
}
