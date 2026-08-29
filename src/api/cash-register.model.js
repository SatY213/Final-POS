const API_URL = "http://localhost:3000";

function getHeaders() {
  let token = null;
  try {
    token = JSON.parse(localStorage.getItem("pos_session"))?.token || null;
  } catch {
    token = null;
  }
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: getHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Cash register request failed");
  return data;
}

export async function getCashRegisters() {
  return (await request("/api/cash-registers")).cash_registers;
}

export async function createCashRegister(data) {
  return (await request("/api/cash-registers", { method: "POST", body: JSON.stringify(data) })).cash_register;
}

export async function updateCashRegister(id, data) {
  return (await request(`/api/cash-registers/${id}`, { method: "PUT", body: JSON.stringify(data) })).cash_register;
}
