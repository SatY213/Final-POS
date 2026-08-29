import React, { useState } from "react";
import { login } from "../../api/auth";
import logo from "../../assets/logo.png";
import { useLanguage } from "../../i18n/LanguageContext";

export default function Login({ onLogin }) {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const result = await login(username, password);
      onLogin(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-10">
      <div className="w-full max-w-[340px]">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center">
          {/* Logo */}
          <img
            src={logo}
            alt="POS Modern"
            className="w-[200px] h-auto mb-5 object-contain"
          />

          <p className="mt-1 text-sm text-black">{t("signInAccount")}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Username */}
          <div>
            <label className="mb-2 block text-sm font-medium text-black">
              {t("username")}
            </label>

            <input
              type="text"
              placeholder={t("enterUsername")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              className="
                w-full
                h-11
                border border-gray-400
                bg-white
                px-3
                text-sm text-black
                outline-none
                placeholder:text-black/50
                focus:border-black
              "
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-black">
              {t("password")}
            </label>

            <input
              type="password"
              placeholder={t("enterPassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="
                w-full
                h-11
                border border-gray-400
                bg-white
                px-3
                text-sm text-black
                outline-none
                placeholder:text-black/50
                focus:border-black
              "
            />
          </div>

          {/* Error */}
          {error && (
            <div className="border border-red-600 bg-white px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Login */}
          <button
            type="submit"
            disabled={loading}
            className="
              mt-1
              h-11
              w-full
              bg-[#099323]
              px-4
              text-sm
              font-semibold
              text-white
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {loading ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-black">POS Modern</p>
      </div>
    </div>
  );
}
