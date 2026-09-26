import { useEffect, useState } from "react";
import { Database, Globe2, RefreshCw } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import Button from "../ui/Button";
import ErrorMessage from "../ui/ErrorMessage";
import ConfirmDialog from "../ui/ConfirmDialog";
import { clearStoredSession } from "../../utils/session";
import { normalizeApiUrl, setConnectionConfig } from "../../api/client";

const inputClass = "h-11 w-full border border-gray-400 bg-white px-3 text-sm outline-none focus:border-black";

export default function ConnectionPanel({ initialConfig = null, onboarding = false, onApplied }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState(initialConfig?.mode || "local");
  const [apiUrl, setApiUrl] = useState(initialConfig?.apiUrl || "");
  const [testedUrl, setTestedUrl] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setMode(initialConfig?.mode || "local");
    setApiUrl(initialConfig?.apiUrl || "");
    setTestedUrl(initialConfig?.mode === "remote" ? initialConfig.apiUrl : "");
  }, [initialConfig]);

  const normalized = () => normalizeApiUrl(apiUrl);
  let normalizedCurrent = "";
  try { normalizedCurrent = mode === "remote" ? normalized() : ""; } catch { normalizedCurrent = ""; }
  const changed = !initialConfig || mode !== initialConfig.mode ||
    (mode === "remote" && normalizedCurrent !== initialConfig.apiUrl);
  async function test() {
    try {
      setBusy(true); setFeedback(null);
      const url = normalized();
      await window.electronAPI.testApiConnection(url);
      setApiUrl(url); setTestedUrl(url);
      setFeedback({ type: "success", message: t("connectionTestSuccess") });
    } catch (error) {
      setTestedUrl("");
      setFeedback({ type: "error", message: error.message });
    } finally { setBusy(false); }
  }
  async function apply() {
    try {
      setBusy(true); setFeedback(null);
      const next = mode === "remote"
        ? { mode, apiUrl: normalized() }
        : { mode: "local", apiUrl: null };
      const saved = await window.electronAPI.saveConnectionConfig(next);
      setConnectionConfig(saved);
      clearStoredSession();
      setConfirming(false);
      onApplied?.(saved);
      if (!onboarding) {
        window.electronAPI?.closeMainWindow?.();
        window.location.reload();
      }
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
      setConfirming(false);
    } finally { setBusy(false); }
  }
  const remoteReady = mode !== "remote" || (!!normalizedCurrent && testedUrl === normalizedCurrent);
  return <div className={onboarding ? "w-full max-w-[620px] border border-gray-300 bg-white" : "border border-gray-300 bg-white"}>
    <ErrorMessage message={feedback?.message || ""} type={feedback?.type} onClose={() => setFeedback(null)} />
    <div className="border-b border-gray-200 p-5">
      <h2 className="text-[17px] font-bold">{t("connectionServer")}</h2>
      <p className="mt-1 text-[11px] text-black/50">{t("connectionServerDescription")}</p>
    </div>
    <div className="space-y-5 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard active={mode === "local"} icon={Database} title={t("localData")} text={t("localDataDescription")} onClick={() => { setMode("local"); setFeedback(null); }} />
        <ModeCard active={mode === "remote"} icon={Globe2} title={t("externalServer")} text={t("externalServerDescription")} onClick={() => { setMode("remote"); setFeedback(null); }} />
      </div>
      {mode === "remote" && <div>
        <label className="mb-2 block text-[12px] font-semibold">{t("apiBaseUrl")}</label>
        <div className="flex gap-2"><input className={inputClass} value={apiUrl} placeholder={t("apiUrlExample")} onChange={(e) => { setApiUrl(e.target.value); setTestedUrl(""); setFeedback(null); }} /><Button icon={RefreshCw} disabled={busy || !apiUrl.trim()} onClick={test}>{t("testConnection")}</Button></div>
        <p className="mt-2 text-[10px] text-black/45">{t("apiUrlSecurityHint")}</p>
      </div>}
      <div className="flex justify-end"><Button variant="primary" disabled={busy || !changed || !remoteReady} onClick={() => onboarding ? apply() : setConfirming(true)}>{onboarding ? t("continue") : t("applyConnection")}</Button></div>
    </div>
    <ConfirmDialog open={confirming} title={t("changeConnectionTitle")} message={t("changeConnectionConfirmation")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} busy={busy} onClose={() => setConfirming(false)} onConfirm={apply} />
  </div>;
}

function ModeCard({ active, icon: Icon, title, text, onClick }) {
  return <button type="button" onClick={onClick} className={`flex min-h-[105px] items-start gap-3 border p-4 text-left ${active ? "border-[#099323] bg-green-50" : "border-gray-300 bg-white"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center ${active ? "bg-[#099323] text-white" : "bg-gray-100"}`}><Icon size={18}/></span><span><b className="text-[13px]">{title}</b><span className="mt-1 block text-[11px] leading-4 text-black/55">{text}</span></span></button>;
}
