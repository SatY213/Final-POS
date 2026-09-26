import { apiPost, apiRaw, toQuery } from "./client";
import { getAuthToken } from "../utils/session";

export const previewImport = (entity, content, format = "csv") => apiPost(`/api/data-exchange/import/${entity}/preview`, { content, format }).then((data) => data.preview);
export const commitImport = (entity, content, duplicate_policy, format = "csv") => apiPost(`/api/data-exchange/import/${entity}/commit`, { content, duplicate_policy, format }).then((data) => data.summary);
async function download(path, filename) {
  const response = await apiRaw(path, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
  if (!response.ok) { let data = {}; try { data = await response.json(); } catch {} throw new Error(data.message || "Download failed"); }
  const blob = await response.blob(), url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
export const downloadImportTemplate = (entity, format = "csv") => download(`/api/data-exchange/templates/${entity}?${toQuery({ format })}`, `modele-${entity}.${format}`);
export const exportData = (entity, query = {}, format = "csv") => download(`/api/data-exchange/export/${entity}?${toQuery({ ...query, format })}`, `export-${entity}.${format}`);
