import { useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import logo from "../../assets/logo.png";
import { useLanguage } from "../../i18n/LanguageContext";

const ERROR_KEYS = {
  invalid_code: "activationInvalidCode",
  inactive_or_expired: "activationInactiveOrExpired",
  device_limit: "activationDeviceLimit",
  rate_limited: "activationRateLimited",
  timeout: "activationTimeout",
  network_error: "activationInternetRequired",
  malformed_response: "activationServerInvalid",
  invalid_license_response: "activationServerInvalid",
  fingerprint_unavailable: "activationFingerprintUnavailable",
  server_unavailable: "activationServerUnavailable",
};

export default function Activation({ onActivated }) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await window.electronAPI.activateSoftware(code);
      if (!result?.ok) {
        setError(t(ERROR_KEYS[result?.code] || "activationFailed"));
        return;
      }
      onActivated();
    } catch {
      setError(t("activationServerUnavailable"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f5] p-6">
      <form onSubmit={submit} className="w-full max-w-[520px] border border-gray-300 bg-white p-8 shadow-sm">
        <img src={logo} alt="" className="mx-auto mb-5 w-[180px]" />
        <div className="mb-7 text-center">
          <h1 className="text-[22px] font-bold">{t("softwareActivation")}</h1>
          <p className="mt-2 text-[13px] leading-5 text-black/55">
            {t("softwareActivationDescription")}
          </p>
        </div>
        <label className="mb-2 block text-[12px] font-semibold" htmlFor="activation-code">
          {t("activationCode")}
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
          <input
            id="activation-code"
            className="input h-[48px] pl-10 font-mono text-[14px] tracking-wide"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="0000-0000-0000-0000-0000"
            autoComplete="off"
            autoFocus
            disabled={loading}
          />
        </div>
        {error && (
          <div role="alert" className="mt-4 border border-red-300 bg-red-50 p-3 text-[12px] leading-5 text-red-800">
            {error}
          </div>
        )}
        <button className="primary mt-6 h-[48px] w-full justify-center text-[14px]" disabled={loading || !code.trim()}>
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {loading ? t("activating") : t("activate")}
        </button>
        <p className="mt-4 text-center text-[11px] text-black/45">{t("activationInternetNotice")}</p>
      </form>
    </main>
  );
}
