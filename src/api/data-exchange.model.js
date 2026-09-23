import { apiPost, toQuery } from "./client";
import { getAuthToken } from "../utils/session";

export const previewImport = (entity, content) => apiPost(`/api/data-exchange/import/${entity}/preview`, { content }).then((data) => data.preview);
export const commitImport = (entity, content, duplicate_policy) => apiPost(`/api/data-exchange/import/${entity}/commit`, { content, duplicate_policy }).then((data) => data.summary);
async function download(path, filename) {
  const response = await fetch(`http://localhost:3000${path}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
  if (!response.ok) { let data = {}; try { data = await response.json(); } catch {} throw new Error(data.message || "Download failed"); }
  const blob = await response.blob(), url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
export const downloadImportTemplate = (entity) => download(`/api/data-exchange/templates/${entity}`, `modele-${entity}.csv`);
export const exportData = (entity, query = {}) => download(`/api/data-exchange/export/${entity}?${toQuery(query)}`, `export-${entity}.csv`);
