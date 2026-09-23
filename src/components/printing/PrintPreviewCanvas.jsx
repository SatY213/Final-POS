import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, FileText, Minus, Plus, RotateCcw } from "lucide-react";
import Button from "../ui/Button";
import { useLanguage } from "../../i18n/LanguageContext";

const pageFor = (format) => format?.startsWith("THERMAL")
  ? { width: format === "THERMAL_58" ? 219 : 302, height: 920, label: format === "THERMAL_58" ? "Ticket 58 mm" : "Ticket 80 mm" }
  : { width: format === "A5" ? 559 : 794, height: format === "A5" ? 794 : 1123, label: format === "A5" ? "A5" : "A4" };

export default function PrintPreviewCanvas({ html, format = "A4", title = "Aperçu" }) {
  const { t } = useLanguage();
  const areaRef = useRef(null);
  const [fit, setFit] = useState(0.7);
  const [zoom, setZoom] = useState(null);
  const page = pageFor(format);
  const pageCount = Math.max(1, (html.match(/class="print-page"/g) || []).length);
  const documentHeight = page.height * pageCount + Math.max(0, pageCount - 1) * 24;
  const scale = zoom ?? fit;

  useEffect(() => {
    const updateFit = () => {
      const rect = areaRef.current?.getBoundingClientRect();
      if (!rect) return;
      setFit(Math.min(1, Math.max(0.2, Math.min((rect.width - 48) / page.width, (rect.height - 48) / page.height))));
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    if (areaRef.current) observer.observe(areaRef.current);
    return () => observer.disconnect();
  }, [page.width, page.height]);

  const adjustZoom = (delta) => setZoom((current) => {
    const base = current ?? fit;
    return Math.min(2.5, Math.max(0.2, Math.round((base + delta) * 100) / 100));
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-100">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-300 bg-white px-4 py-2">
        <span className="text-[11px] font-semibold text-gray-600">{title} · {page.label}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-8 px-2.5" icon={Minus} onClick={() => adjustZoom(-0.1)} aria-label={t("Réduire le zoom")} />
          <button type="button" onClick={() => setZoom(null)} className="min-w-14 text-[11px] font-semibold text-gray-700" title={t("Ajuster à la fenêtre")}>
            {Math.round(scale * 100)} %
          </button>
          <Button className="h-8 px-2.5" icon={Plus} onClick={() => adjustZoom(0.1)} aria-label={t("Augmenter le zoom")} />
          <Button className="h-8 px-2.5" icon={RotateCcw} onClick={() => setZoom(null)}>{t("Ajuster")}</Button>
          <Button className="h-8 px-2.5" icon={FileSpreadsheet} disabled title={t("Export Excel bientôt disponible")}>Excel</Button>
          <Button className="h-8 px-2.5" icon={FileText} disabled title={t("Export Word bientôt disponible")}>Word</Button>
        </div>
      </div>
      <div ref={areaRef} className="min-h-0 flex-1 overflow-auto p-6">
        <div className="flex min-w-full items-start justify-center" style={{ minWidth: page.width * scale, minHeight: documentHeight * scale }}>
          <div className="origin-top shadow-lg" style={{ width: page.width, height: documentHeight, transform: `scale(${scale})` }}>
            <iframe title={title} srcDoc={html} scrolling="no" className="h-full w-full border-0 bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
