import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import {
  buildBarcodeLabelsHtml,
  getBarcodeLabelDimensions,
  isBarcodeValueValid,
  recommendedBarcodeWidthMm,
} from "../../utils/barcodeLabelTemplate";

export default function BarcodeLabelDialog({ products, profile, onClose, setError }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(false);
  const symbology = profile?.configuration?.symbology || "CODE128";

  useEffect(() => {
    setRows(products.map((product) => ({ ...product, quantity: 1 })));
    setPreview(false);
  }, [products]);

  const total = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const invalidRows = rows.filter(
    (row) => Number(row.quantity || 0) > 0 && !isBarcodeValueValid(row.barcode, symbology),
  );
  const invalid = !total || invalidRows.length > 0;
  const labelDimensions = getBarcodeLabelDimensions(profile);
  const printedWidth = Math.min(
    Number(profile?.configuration?.barcode_width_mm || labelDimensions.width),
    labelDimensions.width,
  );
  const readabilityRows = rows
    .filter((row) => Number(row.quantity || 0) > 0 && isBarcodeValueValid(row.barcode, symbology))
    .map((row) => ({
      ...row,
      recommendedWidth: recommendedBarcodeWidthMm(row.barcode, symbology),
    }))
    .filter((row) => row.recommendedWidth > printedWidth);
  const recommendedWidth = Math.max(
    0,
    ...readabilityRows.map((row) => row.recommendedWidth),
  );
  const html = useMemo(() => buildBarcodeLabelsHtml(rows, profile), [rows, profile]);

  async function print() {
    if (invalid) {
      setError(
        `${t("Code-barres invalide pour")} ${symbology}. ${
          symbology === "EAN13"
            ? t("EAN-13 exige 12 chiffres, ou 13 chiffres avec une clé de contrôle valide.")
            : t("Code 128 accepte uniquement les caractères ASCII imprimables.")
        }`,
      );
      return;
    }
    try {
      await window.electronAPI?.printBarcodeLabels?.(rows, profile);
      onClose();
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <Modal
      open={products.length > 0}
      title={t("printLabels")}
      onClose={onClose}
      width="xl"
      footer={
        preview ? (
          <>
            <Button onClick={() => setPreview(false)}>{t("back")}</Button>
            <Button variant="primary" onClick={print} disabled={invalid}>{t("Imprimer")}</Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>{t("Annuler")}</Button>
            <Button onClick={print} disabled={invalid}>{t("Imprimer directement")}</Button>
            <Button variant="primary" onClick={() => setPreview(true)} disabled={invalid}>
              {t("Prévisualiser")}
            </Button>
          </>
        )
      }
    >
      {!preview ? (
        <div className="p-5">
          {invalidRows.length > 0 && (
            <div className="mb-3 border border-red-400 bg-red-50 px-4 py-3 text-[12px] text-red-800">
              {symbology === "EAN13"
                ? t("EAN-13 exige 12 chiffres, ou 13 chiffres avec une clé de contrôle valide.")
                : t("Code 128 accepte uniquement les caractères ASCII imprimables.")}
            </div>
          )}
          {readabilityRows.length > 0 && (
            <div className="mb-3 border border-amber-400 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
              {t("Le code-barres est trop dense pour la largeur configurée. Utilisez une largeur d’au moins")} {recommendedWidth} {t("mm")} {t("ou une étiquette plus large.")}
            </div>
          )}
          <div className="border border-gray-300">
            {rows.map((row, index) => {
              const rowInvalid = Number(row.quantity || 0) > 0 && !isBarcodeValueValid(row.barcode, symbology);
              return (
                <div key={row.id} className="grid grid-cols-[1fr_130px] items-center border-b px-4 py-3 last:border-b-0">
                  <div>
                    <b className="text-[12px]">{row.designation}</b>
                    <p className={`mt-1 text-[10px] ${rowInvalid ? "font-bold text-red-700" : "text-black/50"}`}>
                      {row.barcode || t("Aucun code-barres — impression impossible")}
                    </p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={row.quantity}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, quantity: Math.max(0, Math.min(999, Number(event.target.value) || 0)) }
                            : item,
                        ),
                      )
                    }
                    className="h-9 border border-gray-400 px-2 text-right text-[12px]"
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between border-t-2 border-black pt-3 text-[13px] font-bold">
            <span>{t("Total")}</span>
            <span>{total} {t("étiquette(s)")}</span>
          </div>
        </div>
      ) : (
        <div className="h-[65vh] bg-gray-100 p-4">
          <iframe
            title={t("Prévisualisation des étiquettes")}
            srcDoc={html}
            className="h-full w-full border border-gray-400 bg-white"
          />
        </div>
      )}
    </Modal>
  );
}
