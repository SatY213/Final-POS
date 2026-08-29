const API_URL = "http://localhost:3000";

function headers() {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("pos_session"))?.token || null; } catch { token = null; }
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}
async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Product request failed");
  return data;
}
export async function getProducts(filters = {}) { const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value !== null && value !== undefined)); return request(`/api/products?${query}`); }
export async function getProduct(id) { return (await request(`/api/products/${id}`)).product; }
export async function createProduct(data) { return (await request("/api/products", { method: "POST", body: JSON.stringify(data) })).product; }
export async function updateProduct(id, data) { return (await request(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(data) })).product; }
export async function setProductActive(id, isActive) { return (await request(`/api/products/${id}/status`, { method: "PATCH", body: JSON.stringify({ is_active: isActive }) })).product; }
export async function getProductWarehouses() { return (await request("/api/products/warehouses")).warehouses; }
export async function getCategories() { return (await request("/api/categories")).categories; }
export async function createCategory(data) { return (await request("/api/categories", { method: "POST", body: JSON.stringify(data) })).category; }
export async function updateCategory(id, data) { return (await request(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(data) })).category; }
export async function setCategoryActive(id, isActive) { return (await request(`/api/categories/${id}/status`, { method: "PATCH", body: JSON.stringify({ is_active: isActive }) })).category; }
export async function getUnits() { return (await request("/api/units")).units; }
export async function createUnit(data) { return (await request("/api/units", { method: "POST", body: JSON.stringify(data) })).unit; }
export async function updateUnit(id, data) { return (await request(`/api/units/${id}`, { method: "PUT", body: JSON.stringify(data) })).unit; }
export async function setUnitActive(id, isActive) { return (await request(`/api/units/${id}/status`, { method: "PATCH", body: JSON.stringify({ is_active: isActive }) })).unit; }
