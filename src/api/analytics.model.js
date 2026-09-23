import { apiGet, toQuery } from "./client";

export const getDashboardData = (query = {}) =>
  apiGet(`/api/analytics/dashboard?${toQuery(query)}`);

export const getReportData = (query = {}) =>
  apiGet(`/api/analytics/reports?${toQuery(query)}`);
