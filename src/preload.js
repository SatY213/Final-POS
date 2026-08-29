const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openMainWindow: () => ipcRenderer.send("open-main-window"),
  closeMainWindow: () => ipcRenderer.send("close-main-window"),
});
