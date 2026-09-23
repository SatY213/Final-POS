import { apiGet, apiPost, apiPut, toQuery } from "./client";

export const getSales = (params) => apiGet(`/api/sales?${toQuery(params)}`);
export const getSalesOptions = (warehouseId) =>
  apiGet(`/api/sales/options?${toQuery({ warehouse_id: warehouseId })}`);
export const getSaleDetail = (id) =>
  apiGet(`/api/sales/${id}`).then((data) => data.sale);
export const invoiceSale = (id, body = {}) =>
  apiPost(`/api/sales/${id}/invoice`, body).then((data) => data.invoice);
export const getInvoice = (id) =>
  apiGet(`/api/invoices/${id}`).then((data) => data.invoice);
export const getInvoices = (params) =>
  apiGet(`/api/invoices?${toQuery(params)}`);
export const getInvoiceContext = (warehouseId) =>
  apiGet(`/api/invoices/context?${toQuery({ warehouse_id: warehouseId })}`);
export const getEligibleInvoiceSales = (params) =>
  apiGet(`/api/invoices/eligible-sales?${toQuery(params)}`).then((data) => data.sales);
export const createInvoice = (body) =>
  apiPost("/api/invoices", body).then((data) => data.invoice);
export const addInvoicePayment = (id, body) =>
  apiPost(`/api/invoices/${id}/payments`, body).then((data) => data.invoice);
export const updateInvoice = (id, body) =>
  apiPut(`/api/invoices/${id}`, body).then((data) => data.invoice);
