const API_URL = "http://localhost:3000";

function getToken() {
  const savedSession = localStorage.getItem("pos_session");

  if (!savedSession) {
    return null;
  }

  try {
    const session = JSON.parse(savedSession);
    return session?.token || null;
  } catch {
    return null;
  }
}

function getHeaders() {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getWarehouses() {
  const response = await fetch(`${API_URL}/api/warehouses`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load warehouses");
  }

  return data.warehouses;
}

export async function getWarehouseById(id) {
  const response = await fetch(`${API_URL}/api/warehouses/${id}`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load warehouse");
  }

  return data.warehouse;
}

export async function createWarehouse(warehouseData) {
  const response = await fetch(`${API_URL}/api/warehouses`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(warehouseData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create warehouse");
  }

  return data.warehouse;
}

export async function updateWarehouse(id, warehouseData) {
  const response = await fetch(`${API_URL}/api/warehouses/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(warehouseData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update warehouse");
  }

  return data.warehouse;
}
