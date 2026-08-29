import { Check, Languages } from "lucide-react";
import { useLanguage } from "../../../../i18n/LanguageContext";

export default function LanguageTab() {
  const { language, languages, setLanguage, t } = useLanguage();

  return (
    <section className="border border-gray-300 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center bg-[#e8f7eb] text-[#099323]">
          <Languages size={20} strokeWidth={1.9} />
        </div>
        <div>
          <h2 className="text-[17px] font-bold">{t("language")}</h2>
          <p className="mt-1 text-[12px] text-black/55">
            {t("languageDescription")}
          </p>
        </div>
      </div>

      <div className="p-5">
        <p className="mb-3 text-[12px] font-semibold">{t("currentLanguage")}</p>
        <div className="grid max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(languages).map(([code, item]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              className={`flex h-[68px] items-center justify-between border px-4 text-left ${
                language === code
                  ? "border-[#099323] bg-[#e8f7eb]"
                  : "border-gray-300 bg-white"
              }`}
            >
              <span>
                <span className="block text-[13px] font-semibold">
                  {item.nativeLabel}
                </span>
                <span className="mt-1 block text-[11px] text-black/50">
                  {item.label}
                </span>
              </span>
              {language === code && (
                <Check size={18} className="text-[#087c1e]" />
              )}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-black/50">{t("languageSaved")}</p>
      </div>
    </section>
  );
}
