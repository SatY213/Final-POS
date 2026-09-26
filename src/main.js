import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import started from "electron-squirrel-startup";
import { createLicensingService } from "./licensing/licenseService.mjs";
app.setName("POS Modern");
let apiProcess = null;
let licensingService = null;
let installationActivated = false;
const LOCAL_API_URL = "http://127.0.0.1:3000";
const CONNECTION_FILE = "connection.json";

function connectionFilePath() {
  return path.join(app.getPath("userData"), CONNECTION_FILE);
}
function normalizeApiUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("API URL is invalid");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("API URL must use HTTP or HTTPS without credentials");
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/api$/i, "");
  return url.toString().replace(/\/$/, "");
}
function readConnectionConfig() {
  const file = connectionFilePath();
  if (!fs.existsSync(file)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    // Configurations created by the old automatic migration did not contain
    // this marker. Ask the user once instead of silently forcing local mode.
    if (value.configured !== true) return null;
    if (value.mode === "local")
      return { mode: "local", apiUrl: null, configured: true };
    if (value.mode === "remote")
      return {
        mode: "remote",
        apiUrl: normalizeApiUrl(value.apiUrl),
        configured: true,
      };
  } catch (error) {
    console.error("Invalid connection configuration", error);
  }
  return null;
}
function writeConnectionConfig(config) {
  const file = connectionFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(temporary, file);
}
async function testApiConnection(apiUrl) {
  const base = normalizeApiUrl(apiUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${base}/api/health`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
    const data = await response.json();
    if (
      data.product !== "modern-pos-api" ||
      Number(data.protocol_version) !== 1
    )
      throw new Error("The server is not a compatible MODERN API");
    return { ok: true, apiUrl: base, server: data };
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("The API connection timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
async function waitForLocalApi() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await testApiConnection(LOCAL_API_URL);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError || new Error("The local API did not start");
}

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
  apiProcess.stdout?.on("data", (chunk) =>
    console.log(`[API] ${chunk.toString().trim()}`),
  );
  apiProcess.stderr?.on("data", (chunk) =>
    console.error(`[API] ${chunk.toString().trim()}`),
  );
  apiProcess.on("error", (error) =>
    console.error("POS Modern API failed to start", error),
  );
  apiProcess.on("exit", (code) => {
    console.error(`POS Modern API stopped (exit code ${code}).`);
    apiProcess = null;
  });
}
function stopPackagedApi() {
  apiProcess?.kill();
  apiProcess = null;
}

function assertActivated() {
  if (!installationActivated)
    throw new Error("Software activation is required");
}

ipcMain.handle("get-connection-config", () => {
  assertActivated();
  return readConnectionConfig();
});
ipcMain.handle("test-api-connection", (_event, apiUrl) => {
  assertActivated();
  return testApiConnection(apiUrl);
});
ipcMain.handle("save-connection-config", async (_event, input) => {
  assertActivated();
  const mode = input?.mode === "remote" ? "remote" : "local";
  const config =
    mode === "remote"
      ? { mode, apiUrl: normalizeApiUrl(input.apiUrl), configured: true }
      : { mode, apiUrl: null, configured: true };
  if (mode === "remote") await testApiConnection(config.apiUrl);
  else {
    const wasRunning = Boolean(apiProcess);
    startPackagedApi();
    try {
      if (app.isPackaged) await waitForLocalApi();
    } catch (error) {
      if (!wasRunning) stopPackagedApi();
      throw error;
    }
  }
  writeConnectionConfig(config);
  if (mode === "remote") stopPackagedApi();
  return config;
});
ipcMain.handle("get-license-status", () => {
  const result = licensingService?.validateLocalLicense() || {
    valid: false,
    reason: "unavailable",
  };
  installationActivated = result.valid;
  return { valid: result.valid, reason: result.reason || null };
});
ipcMain.handle("activate-software", async (_event, code) => {
  if (!licensingService) return { ok: false, code: "activation_unavailable" };
  const result = await licensingService.activate(code);
  if (!result.ok) return result;
  installationActivated = true;
  if (readConnectionConfig()?.mode === "local") {
    startPackagedApi();
    if (app.isPackaged) {
      try {
        await waitForLocalApi();
      } catch (error) {
        console.error("Local API did not become ready after activation", error);
      }
    }
  }
  return { ok: true };
});
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
  assertActivated();
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
  assertActivated();
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
  assertActivated();
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
  assertActivated();
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

const createWindow = (activated = installationActivated) => {
  const needsConnectionSetup = !readConnectionConfig();
  const initialWidth = !activated ? 620 : needsConnectionSetup ? 680 : 460;
  const initialHeight = !activated ? 680 : needsConnectionSetup ? 720 : 560;
  const mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,

    minWidth: initialWidth,
    minHeight: initialHeight,

    maxWidth: initialWidth,
    maxHeight: initialHeight,

    resizable: false,
    maximizable: false,

    center: true,
    show: false,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "pos-modern.ico")
      : path.join(app.getAppPath(), "pos-modern.ico"),

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
  ipcMain.on("open-connection-window", () => {
    showConnectionWindow(mainWindow);
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
  licensingService = createLicensingService({
    userDataPath: app.getPath("userData"),
    appVersion: app.getVersion(),
  });
  installationActivated = licensingService.validateLocalLicense().valid;
  if (installationActivated && readConnectionConfig()?.mode === "local")
    startPackagedApi();
  createWindow(installationActivated);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopPackagedApi();
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

const showConnectionWindow = (mainWindow) => {
  mainWindow.unmaximize();
  mainWindow.setMinimumSize(680, 720);
  mainWindow.setMaximumSize(680, 720);
  mainWindow.setResizable(false);
  mainWindow.setMaximizable(false);
  mainWindow.setSize(680, 720);
  mainWindow.center();
};
