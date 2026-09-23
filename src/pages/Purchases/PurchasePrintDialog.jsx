import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import FormField, { inputClass } from "../../components/ui/FormField";
import PrintPreviewCanvas from "../../components/printing/PrintPreviewCanvas";
import { buildCommercialPrintHtml } from "../../utils/commercialPrintTemplate";
import { buildSalePrintHtml } from "../../utils/salePrintTemplate";
import { useLanguage } from "../../i18n/LanguageContext";

const formats = ["A4", "A5", "THERMAL_80", "THERMAL_58"];
const definitionFor = (kind) =>
  kind === "ORDER"
    ? {
        title: "BON DE COMMANDE",
        numberKey: "order_number",
        dateKey: "order_date",
      }
    : {
        title: "BON DE RÉCEPTION",
        numberKey: "receipt_number",
        dateKey: "receipt_date",
      };

export function purchasePrintData(document, kind) {
  const definition = definitionFor(kind);
  return {
    ...document,
    document_number: document?.[definition.numberKey],
    sale_number: document?.[definition.numberKey],
    sale_date: document?.[definition.dateKey],
    customer_name: document?.supplier_name,
    customer_phone: document?.supplier_phone,
    customer_email: document?.supplier_email,
    customer_address: document?.supplier_address,
    customer_nif: document?.supplier_nif,
    customer_nis: document?.supplier_nis,
    customer_tax_article: document?.supplier_tax_article,
    customer_commercial_register: document?.supplier_commercial_register,
    customer_business_activity: document?.supplier_business_activity,
    lines: document?.lines || [],
  };
}

export function purchasePrintProfile(document, kind, format) {
  const definition = definitionFor(kind);
  const selectedFormat =
    format ||
    document?.print_format ||
    document?.print_profile?.paper_format ||
    "A4";
  return {
    ...(document?.print_profile || {}),
    document_type: selectedFormat.startsWith("THERMAL")
      ? "TICKET"
      : kind === "ORDER"
        ? "PURCHASE_ORDER"
        : "PURCHASE_RECEIPT",
    paper_format: selectedFormat,
    configuration: {
      show_warehouse_name: true,
      show_address: true,
      show_phone: true,
      show_email: true,
      show_legal_info: true,
      show_customer: true,
      ...(document?.print_profile?.configuration || {}),
      title: definition.title,
      party_label: "Fournisseur",
      total_label: kind === "ORDER" ? "Total commande" : "Total réception",
    },
  };
}

export async function printPurchaseDirect(document, kind, format) {
  const profile = purchasePrintProfile(document, kind, format);
  const printable = purchasePrintData(document, kind);
  return profile.paper_format.startsWith("THERMAL")
    ? window.electronAPI?.printSale?.(printable, profile)
    : window.electronAPI?.printDocument?.(printable, profile);
}

export default function PurchasePrintDialog({
  document,
  kind = "RECEIPT",
  onClose,
  setError,
}) {
  const { t } = useLanguage();
  const definition = definitionFor(kind);
  const [format, setFormat] = useState("A4");
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!document) return;
    const savedFormat = document.print_format || document.print_profile?.paper_format;
    // "No printing" only controls automatic printing at creation time. A
    // deliberate Print/Reprint action must start with a printable format.
    setFormat(formats.includes(savedFormat) ? savedFormat : "A4");
    setPreview(false);
  }, [document, kind]);
  const profile = useMemo(
    () => purchasePrintProfile(document, kind, format),
    [document, kind, format],
  );
  const printable = useMemo(
    () => purchasePrintData(document, kind),
    [document, kind],
  );
  const html = useMemo(() => {
    if (!document) return "";
    if (!format.startsWith("THERMAL"))
      return buildCommercialPrintHtml(printable, profile);
    const totalLabel = kind === "ORDER" ? "Total commande" : "Total réception";
    return buildSalePrintHtml(printable, profile)
      .replace("<span>Client</span>", "<span>Fournisseur</span>")
      .replace("<span>Total vente</span>", `<span>${totalLabel}</span>`);
  }, [document, printable, profile, format, kind]);
  async function print() {
    try {
      if (format.startsWith("THERMAL"))
        await window.electronAPI?.printSale?.(printable, profile);
      else await window.electronAPI?.printDocument?.(printable, profile);
      onClose();
    } catch (error) {
      setError(error.message);
    }
  }
  const number = document?.[definition.numberKey] || "";
  return (
    <Modal
      open={!!document}
      title={`Imprimer ${number}`}
      onClose={onClose}
      width="xl"
      footer={
        preview ? (
          <>
            <Button onClick={() => setPreview(false)}>{t("back")}</Button>
            <Button variant="primary" onClick={print}>
              {t("Imprimer")}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>{t("Annuler")}</Button>
            <Button onClick={print}>{t("Imprimer directement")}</Button>
            <Button variant="primary" onClick={() => setPreview(true)}>
              {t("Prévisualiser")}
            </Button>
          </>
        )
      }
    >
      {!preview ? (
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <FormField label={t("Document")}>
            <select className={inputClass} value={kind} disabled>
              <option value={kind}>{definition.title}</option>
            </select>
          </FormField>
          <FormField label={t("Format")}>
            <select
              className={inputClass}
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            >
              {formats.map((value) => (
                <option key={value} value={value}>
                  {value.replace("THERMAL_", "Thermal ")}
                  {value.startsWith("THERMAL") ? " mm" : ""}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      ) : (
        <div className="h-[65vh] min-h-0">
          <PrintPreviewCanvas
            html={html}
            format={format}
            title={t("Aperçu impression")}
          />
        </div>
      )}
    </Modal>
  );
}
