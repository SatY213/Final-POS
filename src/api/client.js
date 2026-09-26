import {
  clearStoredSession,
  getAuthToken,
} from "../utils/session.js";

const LOCAL_API_URL = "http://127.0.0.1:3000";
let connectionConfig;
export const AUTH_EXPIRED_EVENT = "pos:auth-expired";

export function normalizeApiUrl(value) {
  let url;
  try { url = new URL(String(value || "").trim()); }
  catch { throw new Error("API URL is invalid"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("API URL must use HTTP or HTTPS without credentials");
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/api$/i, "");
  return url.toString().replace(/\/$/, "");
}
export function setConnectionConfig(value) {
  connectionConfig = value?.mode === "remote"
    ? { mode: "remote", apiUrl: normalizeApiUrl(value.apiUrl) }
    : value
      ? { mode: "local", apiUrl: null }
      : null;
  return connectionConfig;
}
export async function loadConnectionConfig() {
  if (connectionConfig !== undefined) return connectionConfig;
  const value = await window.electronAPI?.getConnectionConfig?.();
  return setConnectionConfig(value || null);
}
export async function getApiBaseUrl() {
  const config = await loadConnectionConfig();
  return config?.mode === "remote" ? config.apiUrl : LOCAL_API_URL;
}

export function toQuery(values = {}) {
  return new URLSearchParams(
    Object.entries(values).filter(([, value]) => value !== "" && value != null),
  );
}

export async function apiRequest(path, { auth = true, body, ...options } = {}) {
  const apiUrl = await getApiBaseUrl();
  const token = auth ? getAuthToken() : null;
  const headers = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(auth ? { Authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    // Ignore late responses from an old session after a new login.
    if (auth && response.status === 401 && token && getAuthToken() === token) {
      clearStoredSession();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function apiRaw(path, options = {}) {
  const apiUrl = await getApiBaseUrl();
  return fetch(`${apiUrl}${path}`, options);
}

export const apiGet = (path, options) => apiRequest(path, { ...options, method: "GET" });
export const apiPost = (path, body, options) => apiRequest(path, { ...options, method: "POST", body });
export const apiPut = (path, body, options) => apiRequest(path, { ...options, method: "PUT", body });
export const apiPatch = (path, body, options) => apiRequest(path, { ...options, method: "PATCH", body });
export const apiDelete = (path, options) => apiRequest(path, { ...options, method: "DELETE" });
