const API_URL = "http://localhost:3000";
function headers() {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("pos_session"))?.token || null; } catch { token = null; }
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "User request failed");
  return data;
}
export async function getUsers() { return (await request("/api/users")).users; }
export async function createUser(data) { return (await request("/api/users", { method: "POST", body: JSON.stringify(data) })).user; }
export async function updateUser(id, data) { return (await request(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) })).user; }
