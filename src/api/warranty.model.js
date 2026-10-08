import { apiGet, apiPost, apiPut, toQuery } from "./client";

export const getWarranties = (filters) =>
  apiGet(`/api/warranties?${toQuery(filters)}`);

export const getWarrantyContext = (warehouseId) =>
  apiGet(`/api/warranties/context?${toQuery({ warehouse_id: warehouseId })}`);

export const getWarranty = (id) =>
  apiGet(`/api/warranties/${id}`).then((data) => data.warranty);

export const createWarranty = (body) =>
  apiPost("/api/warranties", body).then((data) => data.warranty);

export const updateWarranty = (id, body) =>
  apiPut(`/api/warranties/${id}`, body).then((data) => data.warranty);
