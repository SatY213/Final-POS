import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 460,
    height: 560,

    minWidth: 460,
    minHeight: 560,

    maxWidth: 460,
    maxHeight: 560,

    resizable: false,
    maximizable: false,

    center: true,
    show: false,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Expand main window
  ipcMain.on("open-main-window", () => {
    expandMainWindow(mainWindow);
  });
  //  Shrink main window
  ipcMain.on("close-main-window", () => {
    shrinkToLoginWindow(mainWindow);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Keep this only during development.
  mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

const expandMainWindow = (mainWindow) => {
  mainWindow.setResizable(true);
  mainWindow.setMaximizable(true);

  mainWindow.setMinimumSize(1000, 650);
  mainWindow.setMaximumSize(0, 0);

  mainWindow.maximize();
};

const shrinkToLoginWindow = (mainWindow) => {
  mainWindow.unmaximize();

  mainWindow.setMinimumSize(460, 560);
  mainWindow.setMaximumSize(460, 560);

  mainWindow.setResizable(false);
  mainWindow.setMaximizable(false);

  mainWindow.setSize(460, 560);
  mainWindow.center();
};
