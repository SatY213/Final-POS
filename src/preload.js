const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openMainWindow: () => ipcRenderer.send("open-main-window"),
  closeMainWindow: () => ipcRenderer.send("close-main-window"),
  openConnectionWindow: () => ipcRenderer.send("open-connection-window"),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printSale: (sale, profile) =>
    ipcRenderer.invoke("print-sale", { sale, profile }),
  printDocument: (document, profile) =>
    ipcRenderer.invoke("print-document", { document, profile }),
  printBarcodeLabels: (rows, profile) =>
    ipcRenderer.invoke("print-barcode-labels", { rows, profile }),
  printWarranty: (warranty, profile) =>
    ipcRenderer.invoke("print-warranty", { warranty, profile }),
  getConnectionConfig: () => ipcRenderer.invoke("get-connection-config"),
  testApiConnection: (apiUrl) => ipcRenderer.invoke("test-api-connection", apiUrl),
  saveConnectionConfig: (config) =>
    ipcRenderer.invoke("save-connection-config", config),
  getLicenseStatus: () => ipcRenderer.invoke("get-license-status"),
  activateSoftware: (code) => ipcRenderer.invoke("activate-software", code),
});
