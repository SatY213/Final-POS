import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import { translateErrorMessage } from "../../i18n/errorMessages";

const styles = {
  error: { icon: AlertCircle, box: "border-red-300 bg-red-50 text-red-950", iconColor: "text-red-600", button: "hover:bg-red-100" },
  warning: { icon: AlertTriangle, box: "border-amber-300 bg-amber-50 text-amber-950", iconColor: "text-amber-600", button: "hover:bg-amber-100" },
  success: { icon: CheckCircle2, box: "border-green-300 bg-green-50 text-green-950", iconColor: "text-green-600", button: "hover:bg-green-100" },
  info: { icon: Info, box: "border-blue-300 bg-blue-50 text-blue-950", iconColor: "text-blue-600", button: "hover:bg-blue-100" },
};

export default function ErrorMessage({ message, type = "error", onClose, className = "" }) {
  const { language } = useLanguage();
  const [visible, setVisible] = useState(Boolean(message));
  const config = styles[type] || styles.error;
  const Icon = config.icon;

  useEffect(() => setVisible(Boolean(message)), [message]);
  useEffect(() => {
    if (!visible) return;
    const close = (event) => event.key === "Escape" && dismiss();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [visible]);

  function dismiss() {
    setVisible(false);
    onClose?.();
  }

  if (!message || !visible) return null;
  const titles = { en: { error: "Error", warning: "Warning", success: "Success", info: "Information", close: "Close", escape: "Escape to close" }, fr: { error: "Erreur", warning: "Attention", success: "Succès", info: "Information", close: "Fermer", escape: "Échap pour fermer" }, ar: { error: "خطأ", warning: "تنبيه", success: "نجاح", info: "معلومة", close: "إغلاق", escape: "اضغط Escape للإغلاق" } };
  const labels = titles[language] || titles.en;
  return <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4" role="alert" aria-live="assertive"><div className={`pointer-events-auto flex w-full max-w-md items-start gap-3 border-2 p-4 shadow-2xl ${config.box} ${className}`}><Icon className={`mt-0.5 shrink-0 ${config.iconColor}`} size={23}/><div className="min-w-0 flex-1"><p className="text-[12px] font-black uppercase tracking-wide">{labels[type] || labels.error}</p><p className="mt-1 break-words text-[13px] font-medium leading-5">{translateErrorMessage(message, language)}</p><p className="mt-2 text-[10px] opacity-60">{labels.escape}</p></div><button type="button" onClick={dismiss} className={`flex h-8 w-8 shrink-0 items-center justify-center ${config.button}`} aria-label={labels.close} title={labels.close}><X size={18}/></button></div></div>;
}
