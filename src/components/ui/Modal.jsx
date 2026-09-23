import { useEffect } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
const widths = {
  sm: "max-w-[460px]",
  md: "max-w-[620px]",
  lg: "max-w-[760px]",
  xl: "max-w-[980px]",
};
export default function Modal({
  open,
  title,
  onClose,
  width = "md",
  fullScreen = false,
  footer,
  children,
}) {
  const { t } = useLanguage();
  useEffect(() => {
    if (!open) return;
    const key = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/35 ${fullScreen ? "p-0" : "p-4"}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex w-full flex-col border border-gray-400 bg-white shadow-xl ${fullScreen ? "h-full max-h-none max-w-none" : `max-h-[90vh] ${widths[width]}`}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-[16px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="icon-button"
            aria-label={t("Close")}
          >
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 overflow-auto">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-3 border-t border-gray-300 p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
