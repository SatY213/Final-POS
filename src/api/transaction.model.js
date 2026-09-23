import { apiGet } from "./client";
export const getTransactions = (query = {}) => apiGet(`/api/transactions?${new URLSearchParams(query)}`).then(r => r.transactions);
