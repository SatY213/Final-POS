import { apiDelete, apiGet, apiPatch, apiPost, apiPut, toQuery } from "./client";

export const getSuppliers = (filters) =>
  apiGet(`/api/suppliers?${toQuery(filters)}`);
export const getSupplier = (id) =>
  apiGet(`/api/suppliers/${id}`).then((data) => data.supplier);
export const createSupplier = (body) =>
  apiPost("/api/suppliers", body).then((data) => data.supplier);
export const updateSupplier = (id, body) =>
  apiPut(`/api/suppliers/${id}`, body).then((data) => data.supplier);
export const setSupplierActive = (id, is_active) =>
  apiPatch(`/api/suppliers/${id}/status`, { is_active }).then(
    (data) => data.supplier,
  );
export const deleteSupplier = (id) => apiDelete(`/api/suppliers/${id}`);
