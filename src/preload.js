const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openMainWindow: () => ipcRenderer.send("open-main-window"),
  closeMainWindow: () => ipcRenderer.send("close-main-window"),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printSale: (sale, profile) =>
    ipcRenderer.invoke("print-sale", { sale, profile }),
  printDocument: (document, profile) =>
    ipcRenderer.invoke("print-document", { document, profile }),
  printBarcodeLabels: (rows, profile) =>
    ipcRenderer.invoke("print-barcode-labels", { rows, profile }),
});
