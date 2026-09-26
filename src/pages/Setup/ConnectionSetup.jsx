import logo from "../../assets/logo.png";
import ConnectionPanel from "../../components/connection/ConnectionPanel";
import { useLanguage } from "../../i18n/LanguageContext";

export default function ConnectionSetup({ onComplete }) {
  const { t } = useLanguage();
  return <div className="flex min-h-screen items-center justify-center bg-[#f5f7f5] p-6"><div className="w-full max-w-[620px]"><div className="mb-5 text-center"><img src={logo} alt="POS Modern" className="mx-auto mb-3 w-[170px]"/><h1 className="text-[20px] font-bold">{t("initialConnectionSetup")}</h1><p className="mt-1 text-[12px] text-black/50">{t("initialConnectionSetupDescription")}</p></div><ConnectionPanel onboarding onApplied={onComplete}/></div></div>;
}
