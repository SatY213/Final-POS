import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import FormField, { inputClass } from "../../components/ui/FormField";
import { buildSalePrintHtml, profileTypeForDocument } from "../../utils/salePrintTemplate";
import { buildCommercialPrintHtml } from "../../utils/commercialPrintTemplate";
import PrintPreviewCanvas from "../../components/printing/PrintPreviewCanvas";
import { useLanguage } from "../../i18n/LanguageContext";

const documents = [
  ["TICKET", "Ticket"],
  ["BON_POUR", "Bon pour"],
  ["DELIVERY_NOTE", "Bon de livraison"],
];
const formatsFor = (type) => type === "TICKET" ? ["THERMAL_80", "THERMAL_58"] : ["A4", "A5", "THERMAL_80", "THERMAL_58"];

export default function SalePrintDialog({ sale, onClose, setError }) {
  const { t } = useLanguage();
  const [documentType, setDocumentType] = useState("BON_POUR"), [format, setFormat] = useState("A4"), [preview, setPreview] = useState(false);
  const profile = useMemo(() => {
    const profiles = sale?.print_profiles || (sale?.print_profile ? [sale.print_profile] : []);
    return profiles.find((item) => item.document_type === profileTypeForDocument(documentType)) || profiles[0] || {};
  }, [sale, documentType]);
  useEffect(() => { if (!sale) return; setDocumentType(sale.document_type === "TICKET" ? "TICKET" : "BON_POUR"); setPreview(false); }, [sale]);
  useEffect(() => { if (profile.paper_format) setFormat(profile.paper_format); }, [profile]);
  const selected = { ...profile, document_type: documentType, paper_format: format, configuration: profile.configuration || {} };
  const html = useMemo(() => sale ? (documentType === "TICKET" ? buildSalePrintHtml(sale, selected) : buildCommercialPrintHtml(sale, selected)) : "", [sale, documentType, selected.document_type, selected.paper_format, profile]);
  async function print() { try { await window.electronAPI?.printSale?.(sale, selected); onClose(); } catch (e) { setError(e.message); } }
  return <Modal open={!!sale} title={`Imprimer ${sale?.sale_number || ""}`} onClose={onClose} width="xl" footer={preview ? <><Button onClick={() => setPreview(false)}>{t("back")}</Button><Button variant="primary" onClick={print}>{t("Imprimer")}</Button></> : <><Button onClick={onClose}>{t("Annuler")}</Button><Button onClick={print}>{t("Imprimer directement")}</Button><Button variant="primary" onClick={() => setPreview(true)}>{t("Prévisualiser")}</Button></>}>
    {!preview ? <div className="grid gap-4 p-5 sm:grid-cols-2"><FormField label={t("Document")}><select className={inputClass} value={documentType} onChange={(e) => setDocumentType(e.target.value)}>{documents.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField><FormField label={t("Format")}><select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value)}>{formatsFor(documentType).map((value) => <option key={value} value={value}>{value.replace("THERMAL_", "Thermal ")} {value.startsWith("THERMAL") ? "mm" : ""}</option>)}</select></FormField></div> : <div className="h-[65vh] min-h-0"><PrintPreviewCanvas html={html} format={format} title={t("Aperçu impression")} /></div>}
  </Modal>;
}
