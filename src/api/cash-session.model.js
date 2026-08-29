const API_URL = "http://localhost:3000";

function headers() {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("pos_session"))?.token || null; } catch { token = null; }
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Cash session request failed");
  return data;
}

export async function getCurrentCashSession() { return (await request("/api/cash-sessions/current")).cash_session; }
export async function getAvailableCashRegisters(warehouseId) { return (await request(`/api/cash-sessions/available-registers?warehouse_id=${warehouseId}`)).cash_registers; }
export async function openCashSession(data) { return (await request("/api/cash-sessions/open", { method: "POST", body: JSON.stringify(data) })).cash_session; }
export async function closeCashSession(id, data) { return (await request(`/api/cash-sessions/${id}/close`, { method: "POST", body: JSON.stringify(data) })).cash_session; }
export async function createCashMovement(id, data) { return (await request(`/api/cash-sessions/${id}/movements`, { method: "POST", body: JSON.stringify(data) })).cash_session; }
export async function getCashSessions(filters = {}) { const query = new URLSearchParams(Object.entries(filters).filter(([,value]) => value !== "" && value != null)); return request(`/api/cash-sessions?${query}`); }
export async function getCashSession(id) { return request(`/api/cash-sessions/${id}`); }
