import { apiGet, apiPost, apiPut, toQuery } from "./client";
export const getPosContext = (warehouseId) =>
  apiGet(`/api/pos/context?${toQuery({ warehouse_id: warehouseId })}`);
export const searchPosProducts = (q, warehouseId) =>
  apiGet(
    `/api/pos/search-products?${toQuery({ q, warehouse_id: warehouseId })}`,
  ).then((data) => data.products);
export const searchPosCustomers = (q) =>
  apiGet(`/api/pos/customers?${toQuery({ q })}`).then((data) => data.customers);
export const getPosProductUnits = (id) =>
  apiGet(`/api/pos/products/${id}/units`).then((data) => data.units);
export const getPosProductSerials = (id, warehouseId) =>
  apiGet(`/api/pos/products/${id}/serials?${toQuery({ warehouse_id: warehouseId })}`).then(
    (data) => data.serials,
  );
export const addPosProductSerial = (id, body) =>
  apiPost(`/api/pos/products/${id}/serials`, body).then((data) => data.serial);
export const finalizeSale = (body) =>
  apiPost("/api/pos/sales", body).then((data) => data.sale);
export const suspendSale = (body) =>
  apiPost("/api/pos/suspend", body).then((data) => data.sale);
export const getSuspendedSales = (warehouseId) =>
  apiGet(`/api/pos/suspended?${toQuery({ warehouse_id: warehouseId })}`).then(
    (data) => data.sales,
  );
export const getPosSale = (id) =>
  apiGet(`/api/pos/sales/${id}`).then((data) => data.sale);
export const updatePosSale = (id, body) =>
  apiPut(`/api/pos/sales/${id}`, body).then((data) => data.sale);
