import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import started from "electron-squirrel-startup";
app.setName("POS Modern");
let apiProcess = null;

function startPackagedApi() {
  if (!app.isPackaged || apiProcess) return;
  const runtimePath = path.join(process.resourcesPath, "build-runtime");
  const serverPath = path.join(runtimePath, "server", "server.js");
  apiProcess = spawn(path.join(runtimePath, "node.exe"), [serverPath], {
    cwd: path.join(runtimePath, "server"),
    env: {
      ...process.env,
      POS_DATA_DIR: app.getPath("userData"),
      POS_BOOTSTRAP_DB: path.join(process.resourcesPath, "pos-modern.db"),
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  apiProcess.stdout?.on("data", (chunk) => console.log(`[API] ${chunk.toString().trim()}`));
  apiProcess.stderr?.on("data", (chunk) => console.error(`[API] ${chunk.toString().trim()}`));
  apiProcess.on("error", (error) => console.error("POS Modern API failed to start", error));
  apiProcess.on("exit", (code) => {
    console.error(`POS Modern API stopped (exit code ${code}).`);
    apiProcess = null;
  });
}
import { buildSalePrintHtml } from "./utils/salePrintTemplate";
import { buildBarcodeLabelsHtml } from "./utils/barcodeLabelTemplate";
import { buildCommercialPrintHtml } from "./utils/commercialPrintTemplate";
import { buildBarcodePrintOptions } from "./utils/barcodePrintOptions";

async function waitForPrintableContent(webContents) {
  await webContents.executeJavaScript(`(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all([...document.images].map(image => {
      if (image.complete) return image.decode?.().catch(() => {}) || Promise.resolve();
      return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  })()`);
}

async function barcodePrintDiagnostics(webContents, profile, options) {
  const rendered = await webContents.executeJavaScript(`(() => {
    const label = document.querySelector('.label');
    const barcode = document.querySelector('.barcode');
    const labelRect = label?.getBoundingClientRect();
    const barcodeRect = barcode?.getBoundingClientRect();
    const pageRule = [...document.styleSheets].flatMap(sheet => {
      try { return [...sheet.cssRules]; } catch { return []; }
    }).find(rule => rule.type === CSSRule.PAGE_RULE);
    const rect = value => value ? {
      x: value.x, y: value.y, width: value.width, height: value.height
    } : null;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      cssPageSize: pageRule?.style?.getPropertyValue('size') || null,
      labelRect: rect(labelRect),
      barcodeRect: rect(barcodeRect),
      fontsStatus: document.fonts?.status || 'unsupported',
      images: [...document.images].map(image => ({
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight
      }))
    };
  })()`);
  const printers = await webContents.getPrintersAsync();
  const printer = printers.find((item) => item.name === options.deviceName);
  console.info("BARCODE PRINT DIAGNOSTICS", {
    mode: options.silent ? "AUTO/SILENT" : "MANUAL",
    electron: process.versions.electron,
    requestedPrinter: options.deviceName || "SYSTEM_DEFAULT",
    resolvedPrinter: printer
      ? {
          name: printer.name,
          displayName: printer.displayName,
          description: printer.description,
          status: printer.status,
          isDefault: printer.isDefault,
          options: printer.options,
        }
      : null,
    configuredMedia: {
      format: profile?.paper_format,
      widthMm: options.pageSize.width / 1000,
      heightMm: options.pageSize.height / 1000,
      gapMm: Number(profile?.configuration?.content_gap_mm ?? 0),
    },
    rendered,
    finalPrintOptions: options,
  });
}

ipcMain.handle("get-printers", async (event) => {
  const printers = await event.sender.getPrintersAsync();
  return printers.map(
    ({ name, displayName, description, status, isDefault }) => ({
      name,
      displayName,
      description,
      status,
      isDefault,
    }),
  );
});
ipcMain.handle("print-sale", async (_event, { sale, profile }) => {
  if (!sale?.sale_number) throw new Error("Sale document is invalid");
  if (profile?.paper_format === "NONE")
    return { printed: false, skipped: true };
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });
  let html =
    profile?.document_type === "TICKET"
      ? buildSalePrintHtml(sale, profile)
      : buildCommercialPrintHtml(sale, profile);
  if (profile?.configuration?.party_label)
    html = html.replace(
      "<span>Client</span>",
      `<span>${profile.configuration.party_label}</span>`,
    );
  if (profile?.configuration?.total_label)
    html = html.replace(
      "<span>Total vente</span>",
      `<span>${profile.configuration.total_label}</span>`,
    );
  await window.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );
  try {
    await new Promise((resolve, reject) =>
      window.webContents.print(
        {
          silent: !!profile?.auto_print,
          deviceName: profile?.system_name || undefined,
          copies: Number(profile?.copies || 1),
          printBackground: true,
        },
        (ok, reason) =>
          ok ? resolve() : reject(new Error(reason || "Printing failed")),
      ),
    );
  } finally {
    window.destroy();
  }
  return { printed: true };
});
ipcMain.handle("print-barcode-labels", async (_event, { rows, profile }) => {
  if (!Array.isArray(rows) || !rows.length)
    throw new Error("No barcode label selected");
  const html = buildBarcodeLabelsHtml(rows, profile),
    window = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true },
    });
  const didFinishLoad = new Promise((resolve) =>
    window.webContents.once("did-finish-load", resolve),
  );
  await window.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );
  await didFinishLoad;
  await waitForPrintableContent(window.webContents);
  try {
    const printOptions = buildBarcodePrintOptions(
      profile,
      !!profile?.auto_print,
    );
    await barcodePrintDiagnostics(window.webContents, profile, printOptions);
    await new Promise((resolve, reject) =>
      window.webContents.print(printOptions, (ok, reason) =>
        ok ? resolve() : reject(new Error(reason || "Printing failed")),
      ),
    );
  } finally {
    window.destroy();
  }
  return {
    printed: true,
    count: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
  };
});
ipcMain.handle("print-document", async (_event, { document, profile }) => {
  const number =
    document?.invoice_number ||
    document?.delivery_number ||
    document?.quote_number ||
    document?.order_number ||
    document?.receipt_number ||
    document?.return_number ||
    document?.document_number;
  if (!number) throw new Error("Document is invalid");
  const printable = {
    ...document,
    sale_number: number,
    total: document.total || 0,
  };
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });
  const html = buildCommercialPrintHtml(printable, profile);
  await window.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );
  try {
    await new Promise((resolve, reject) =>
      window.webContents.print(
        {
          silent: !!profile?.auto_print,
          deviceName: profile?.system_name || undefined,
          copies: Number(profile?.copies || 1),
          printBackground: true,
        },
        (ok, reason) =>
          ok ? resolve() : reject(new Error(reason || "Printing failed")),
      ),
    );
  } finally {
    window.destroy();
  }
  return { printed: true };
});
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
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "app-icon.png")
      : path.join(app.getAppPath(), "build-assets", "app-icon.png"),

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
};

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  startPackagedApi();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  apiProcess?.kill();
  apiProcess = null;
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
