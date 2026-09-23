import {
  clearStoredSession,
  getAuthToken,
} from "../utils/session.js";

const API_URL = "http://localhost:3000";
export const AUTH_EXPIRED_EVENT = "pos:auth-expired";

export function toQuery(values = {}) {
  return new URLSearchParams(
    Object.entries(values).filter(([, value]) => value !== "" && value != null),
  );
}

export async function apiRequest(path, { auth = true, body, ...options } = {}) {
  const token = auth ? getAuthToken() : null;
  const headers = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(auth ? { Authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetch(`${API_URL}${path}`, {
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

export const apiGet = (path, options) => apiRequest(path, { ...options, method: "GET" });
export const apiPost = (path, body, options) => apiRequest(path, { ...options, method: "POST", body });
export const apiPut = (path, body, options) => apiRequest(path, { ...options, method: "PUT", body });
export const apiPatch = (path, body, options) => apiRequest(path, { ...options, method: "PATCH", body });
export const apiDelete = (path, options) => apiRequest(path, { ...options, method: "DELETE" });
