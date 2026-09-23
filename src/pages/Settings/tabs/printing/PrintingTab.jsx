import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Printer } from "lucide-react";
import ErrorMessage from "../../../../components/ui/ErrorMessage";
import FormField, { inputClass } from "../../../../components/ui/FormField";
import {
  getPrinters,
  getPrintProfiles,
  savePrinter,
  savePrintProfile,
  getSettings,
  updateSettings,
} from "../../../../api/settings.model";
import { useLanguage } from "../../../../i18n/LanguageContext";
import { buildBarcodeLabelsHtml } from "../../../../utils/barcodeLabelTemplate";
const formats = {
  SALE: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
  SALE_TICKET: ["THERMAL_80", "THERMAL_58"],
  SALE_INVOICE: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
  SHIPPING_INVOICE: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
  INVOICE: ["A4", "A5"],
  QUOTE: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
  SALES_RETURN: ["A4", "A5", "80mm", "58mm"],
  PURCHASE_ORDER: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
  PURCHASE_RECEIPT: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
  PURCHASE_RETURN: ["A4", "A5", "THERMAL_80", "THERMAL_58"],
  BARCODE_LABEL: ["40x25mm", "50x30mm", "60x40mm", "CUSTOM"],
};
export default function PrintingTab() {
  const { t } = useLanguage(),
    [printers, setPrinters] = useState([]),
    [profiles, setProfiles] = useState([]),
    [systemPrinters, setSystemPrinters] = useState([]),
    [error, setError] = useState("");
  const profilesRef = useRef([]);
  const profileTimersRef = useRef({});
  const [profileMessages, setProfileMessages] = useState({});
  const [openType, setOpenType] = useState(null);
  const [printingSettings, setPrintingSettings] = useState({
    allow_format_override: true,
  });
  async function load() {
    try {
      setError("");
      const [p, r, rules] = await Promise.all([
        getPrinters(),
        getPrintProfiles(),
        getSettings("printing"),
      ]);
      setPrinters(p);
      setProfiles(r);
      profilesRef.current = r;
      setPrintingSettings(rules);
      if (window.electronAPI?.getPrinters)
        setSystemPrinters(await window.electronAPI.getPrinters());
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    load();
    return () => Object.values(profileTimersRef.current).forEach(window.clearTimeout);
  }, []);
  function profileChange(type, patch) {
    const current = profilesRef.current.find((item) => item.document_type === type);
    if (!current) return;
    const next = { ...current, ...patch };
    const updated = profilesRef.current.map((item) => item.document_type === type ? next : item);
    profilesRef.current = updated;
    setProfiles(updated);
    window.clearTimeout(profileTimersRef.current[type]);
    profileTimersRef.current[type] = window.setTimeout(() => persist(type), 650);
  }
  async function persist(type) {
    try {
      setError("");
      setProfileMessages((current) => ({ ...current, [type]: null }));
      const profile = profilesRef.current.find((item) => item.document_type === type);
      const saved = await savePrintProfile(profile.document_type, profile);
      setProfiles((items) =>
        items.map((item) =>
          item.document_type === saved.document_type ? saved : item,
        ),
      );
      profilesRef.current = profilesRef.current.map((item) => item.document_type === saved.document_type ? saved : item);
      setProfileMessages((current) => ({
        ...current,
        [type]: { kind: "success", text: t("printSettingsSaved") },
      }));
    } catch (err) {
      setProfileMessages((current) => ({
        ...current,
        [type]: { kind: "error", text: err.message || t("saveFailed") },
      }));
    }
  }
  async function chooseSystemPrinter(type, systemName) {
    try {
      setProfileMessages((current) => ({ ...current, [type]: null }));
      if (!systemName) {
        profileChange(type, { printer_id: null });
        return;
      }
      let configured = printers.find(
        (printer) =>
          printer.system_name === systemName &&
          printer.is_active &&
          printer.printer_type === "GENERIC",
      );
      if (!configured) {
        const systemPrinter = systemPrinters.find(
          (printer) => printer.name === systemName,
        );
        const savedPrinters = await savePrinter({
          name: systemPrinter?.displayName || systemPrinter?.name || systemName,
          system_name: systemName,
          printer_type: "GENERIC",
          is_active: true,
        });
        setPrinters(savedPrinters);
        configured = savedPrinters.find(
          (printer) => printer.system_name === systemName && printer.is_active,
        );
      }
      profileChange(type, { printer_id: configured.id });
    } catch (err) {
      setProfileMessages((current) => ({
        ...current,
        [type]: {
          kind: "error",
          text: err.message || t("printerSelectFailed"),
        },
      }));
    }
  }
  return (
    <div className="space-y-4">
      <section className="flex items-center justify-between border border-gray-300 bg-white p-4 text-[12px] font-semibold">
        <span>{t("allowPrintFormatOverride")}</span>
        <input
          type="checkbox"
          checked={!!printingSettings.allow_format_override}
          onChange={async (e) => {
            const next = {
              ...printingSettings,
              allow_format_override: e.target.checked,
            };
            setPrintingSettings(next);
            try {
              setPrintingSettings(await updateSettings("printing", next));
            } catch (err) {
              setError(err.message);
            }
          }}
        />
      </section>
      <ErrorMessage message={error} />
      <section className="border border-gray-300 bg-white">
        <Header
          title={t("printProfiles")}
          description={t("printProfilesDescription")}
        />
        <div className="space-y-2 p-5">
          {profiles.map((profile) => (
            <div key={profile.id} className="border border-gray-300">
              <button
                type="button"
                onClick={() =>
                  setOpenType((current) =>
                    current === profile.document_type
                      ? null
                      : profile.document_type,
                  )
                }
                className="flex h-12 w-full items-center justify-between bg-gray-50 px-4 text-left text-[13px] font-semibold"
              >
                <span className="flex items-center gap-2">
                  <Printer size={16} />
                  {t(profile.document_type)}
                </span>
                {openType === profile.document_type ? (
                  <ChevronDown size={17} />
                ) : (
                  <ChevronRight size={17} />
                )}
              </button>
              {openType === profile.document_type && (
                <Profile
                  profile={profile}
                  printers={printers}
                  systemPrinters={systemPrinters}
                  onPrinterChange={(systemName) =>
                    chooseSystemPrinter(profile.document_type, systemName)
                  }
                  onChange={(patch) =>
                    profileChange(profile.document_type, patch)
                  }
                  message={profileMessages[profile.document_type]}
                  t={t}
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function Profile({
  profile,
  printers,
  systemPrinters,
  onPrinterChange,
  onChange,
  message,
  t,
}) {
  const config = profile.configuration || {};
  const saleProfile = [
    "SALE",
    "SALE_TICKET",
    "SALE_INVOICE",
    "SHIPPING_INVOICE",
    "INVOICE",
  ].includes(profile.document_type);
  const purchaseProfile = ["PURCHASE_ORDER", "PURCHASE_RECEIPT", "PURCHASE_RETURN"].includes(profile.document_type);
  const titledProfile = saleProfile || profile.document_type === "QUOTE" || purchaseProfile;
  const flags =
    saleProfile
      ? [
          "show_logo",
          "show_warehouse_name",
          "show_address",
          "show_phone",
          "show_email",
          "show_legal_info",
          "show_cashier",
          "show_cash_register",
          "show_customer",
          "show_product_reference",
          "show_payment_details",
          "show_received_amount",
          "show_change",
          ...(profile.document_type === "SALE_TICKET" ? [] : ["show_discounts"]),
        ]
      : purchaseProfile
        ? ["show_logo", "show_warehouse_name", "show_address", "show_phone", "show_email", "show_legal_info", "show_customer", "show_product_reference", "show_discounts"]
      : ["SALE_INVOICE", "QUOTE"].includes(profile.document_type)
        ? [
            "show_logo",
            "show_legal_info",
            "show_product_reference",
            "show_signature_area",
            "show_stamp_area",
            "show_discounts",
          ]
        : profile.document_type === "BARCODE_LABEL"
          ? ["show_product_name", "show_price", "show_reference"]
          : profile.document_type === "DELIVERY_NOTE"
            ? [
                "show_logo",
                "show_legal_info",
                "show_product_reference",
                "show_signature_area",
              ]
            : [
                "show_logo",
                "show_legal_info",
                "show_product_reference",
                "show_discounts",
              ];
  const selectedPrinter = printers.find(
    (item) => item.id === profile.printer_id,
  );
  return (
    <div className="space-y-5 border-t border-gray-300 p-5">
      {titledProfile && (
        <FormField label={t("documentTitle")}>
          <input
            value={config.title || ""}
            onChange={(e) =>
              onChange({ configuration: { ...config, title: e.target.value } })
            }
            className={inputClass}
          />
        </FormField>
      )}
      {profile.document_type === "SALE" && (
        <FormField label={t("defaultDocument")}>
          <select
            value={config.default_document || "BON_POUR"}
            onChange={(e) =>
              onChange({
                configuration: {
                  ...config,
                  default_document: e.target.value,
                },
              })
            }
            className={inputClass}
          >
            {["TICKET", "BON_POUR"].map(
              (value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ),
            )}
          </select>
        </FormField>
      )}
      <FormField label={t("printer")}>
        <select
          value={selectedPrinter?.system_name || ""}
          onChange={(e) => onPrinterChange(e.target.value)}
          className={inputClass}
        >
          <option value="">{t("none")}</option>
          {!systemPrinters.length && (
            <option value="" disabled>
              {t("noAvailablePrinters")}
            </option>
          )}
          {systemPrinters.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName || p.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={t("paperFormat")}>
        <select
          value={profile.paper_format}
          onChange={(e) => onChange({ paper_format: e.target.value })}
          className={inputClass}
        >
          {(formats[profile.document_type] || formats.SALE).map((f) => (
            <option key={f} value={f}>
              {f === "NONE"
                ? t("noPrinting")
                : f === "CUSTOM"
                  ? t("customDimensions")
                  : f === "58mm"
                    ? t("thermal58")
                    : f === "80mm"
                      ? t("thermal80")
                      : f}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={t("copies")}>
        <input
          type="number"
          min="1"
          max="10"
          value={profile.copies}
          onChange={(e) => onChange({ copies: Number(e.target.value) })}
          className={inputClass}
        />
      </FormField>
      <label className="flex justify-between text-[12px] font-semibold">
        {t("autoPrint")}
        <input
          type="checkbox"
          checked={!!profile.auto_print}
          onChange={(e) => onChange({ auto_print: e.target.checked })}
        />
      </label>
      {profile.document_type === "BARCODE_LABEL" && (
        <>
          <FormField label={t("barcodeSymbology")}>
            <select
              value={config.symbology || "CODE128"}
              onChange={(e) =>
                onChange({
                  configuration: { ...config, symbology: e.target.value },
                })
              }
              className={inputClass}
            >
              <option>CODE128</option>
              <option>EAN13</option>
            </select>
          </FormField>
          {profile.paper_format === "CUSTOM" && (
            <div className="grid grid-cols-2 gap-5">
              <LabelNumber
                label={t("labelWidthMm")}
                value={config.label_width_mm ?? 50}
                min="20"
                max="150"
                onChange={(value) =>
                  onChange({
                    configuration: { ...config, label_width_mm: value },
                  })
                }
              />
              <LabelNumber
                label={t("labelHeightMm")}
                value={config.label_height_mm ?? 30}
                min="15"
                max="100"
                onChange={(value) =>
                  onChange({
                    configuration: { ...config, label_height_mm: value },
                  })
                }
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-5">
            <LabelNumber
              label={t("labelNameFontPx")}
              value={config.name_font_size ?? 10}
              min="6"
              max="30"
              onChange={(value) =>
                onChange({
                  configuration: { ...config, name_font_size: value },
                })
              }
            />
            <LabelNumber
              label={t("labelPriceFontPx")}
              value={config.price_font_size ?? 13}
              min="6"
              max="36"
              onChange={(value) =>
                onChange({
                  configuration: { ...config, price_font_size: value },
                })
              }
            />
            <LabelNumber
              label={t("labelReferenceFontPx")}
              value={config.reference_font_size ?? 8}
              min="6"
              max="24"
              onChange={(value) =>
                onChange({
                  configuration: { ...config, reference_font_size: value },
                })
              }
            />
            <LabelNumber
              label={t("barcodeHeightMm")}
              value={config.barcode_height_mm ?? 13}
              min="6"
              max="60"
              onChange={(value) =>
                onChange({
                  configuration: { ...config, barcode_height_mm: value },
                })
              }
            />
            <LabelNumber
              label={t("labelGapMm")}
              value={config.content_gap_mm ?? 1}
              min="0"
              max="10"
              onChange={(value) =>
                onChange({
                  configuration: { ...config, content_gap_mm: value },
                })
              }
            />
            <LabelNumber
              label={t("labelPaddingMm")}
              value={config.label_padding_mm ?? 2}
              min="0"
              max="10"
              onChange={(value) =>
                onChange({
                  configuration: { ...config, label_padding_mm: value },
                })
              }
            />
          </div>
          <FormField label={t("pricePosition")}>
            <select
              value={config.price_position || "TOP"}
              onChange={(event) =>
                onChange({
                  configuration: {
                    ...config,
                    price_position: event.target.value,
                  },
                })
              }
              className={inputClass}
            >
              <option value="TOP">{t("top")}</option>
              <option value="BOTTOM">{t("bottom")}</option>
            </select>
          </FormField>
          <label className="flex justify-between text-[11px]">
            {t("showBarcodeNumber")}
            <input
              type="checkbox"
              checked={config.show_barcode_text !== false}
              onChange={(event) =>
                onChange({
                  configuration: {
                    ...config,
                    show_barcode_text: event.target.checked,
                  },
                })
              }
            />
          </label>
        </>
      )}
      {saleProfile && (
        <FormField label={t("orientation")}>
          <select
            value={config.orientation || "PORTRAIT"}
            onChange={(e) =>
              onChange({
                configuration: { ...config, orientation: e.target.value },
              })
            }
            className={inputClass}
          >
            <option value="PORTRAIT">{t("PORTRAIT")}</option>
            <option value="LANDSCAPE">{t("LANDSCAPE")}</option>
          </select>
        </FormField>
      )}
      {flags.map((key) => (
        <label key={key} className="flex justify-between text-[11px]">
          {t(purchaseProfile && key === "show_customer" ? "print_show_supplier" : `print_${key}`)}
          <input
            type="checkbox"
            checked={key === "show_discounts" ? (config[key] ?? profile.document_type !== "INVOICE") : purchaseProfile ? (config[key] ?? true) : !!config[key]}
            onChange={(e) =>
              onChange({
                configuration: { ...config, [key]: e.target.checked },
              })
            }
          />
        </label>
      ))}
      {profile.document_type !== "BARCODE_LABEL" && (
        <FormField label={t("footerMessage")}>
          <textarea
            value={config.footer_message || ""}
            onChange={(e) =>
              onChange({
                configuration: { ...config, footer_message: e.target.value },
              })
            }
            className="w-full border border-gray-400 p-2 text-[12px]"
          />
        </FormField>
      )}
      <ProfilePreview
        type={profile.document_type}
        config={config}
        format={profile.paper_format}
        t={t}
      />
      <p className="border-t border-gray-200 pt-3 text-right text-[11px] text-black/45">{t("autoSave")}</p>
      {message && (
        <p
          className={`border px-3 py-2 text-[11px] ${message.kind === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
function ProfilePreview({ type, config, format, t }) {
  if (type === "BARCODE_LABEL")
    return (
      <iframe
        title={t("labelPreview")}
        className="h-44 w-full border border-dashed border-gray-400 bg-gray-100"
        srcDoc={buildBarcodeLabelsHtml(
          [
            {
              designation: t("sampleProduct"),
              reference: "REF-001",
              selling_price: 100,
              barcode: "123456789012",
              quantity: 1,
            },
          ],
          { paper_format: format, configuration: config, preview: true },
        )}
      />
    );
  return (
    <div
      className={`border border-dashed border-gray-400 bg-white p-3 ${type === "SALE" ? "mx-auto max-w-[320px]" : ""}`}
    >
      <div className="my-2 border-t border-dashed" />
      <div className="flex justify-between text-[10px]">
        <span>{t("product")}</span>
        <span>100.00 DA</span>
      </div>
      <div className="mt-2 flex justify-between border-t pt-2 text-[10px] font-bold">
        <span>{t("total")}</span>
        <span>100.00 DA</span>
      </div>
      {config.footer_message && (
        <p className="mt-3 text-center text-[9px]">{config.footer_message}</p>
      )}
    </div>
  );
}
function Header({ title, description }) {
  return (
    <div className="border-b border-gray-200 px-5 py-4">
      <h2 className="text-[17px] font-bold">{title}</h2>
      <p className="mt-1 text-[12px] text-black/55">{description}</p>
    </div>
  );
}
function LabelNumber({ label, value, onChange, ...props }) {
  return (
    <FormField label={label}>
      <input
        type="number"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={inputClass}
        {...props}
      />
    </FormField>
  );
}
