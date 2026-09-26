const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const Database = require("better-sqlite3");

const root = path.resolve(__dirname, "../..");
const resources = path.join(root, "out", "POS Modern-win32-x64", "resources");
const nodeExecutable = path.join(resources, "build-runtime", "node.exe");
const serverFile = path.join(resources, "build-runtime", "server", "server.js");
const bootstrap = path.join(resources, "pos-modern.db");

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

async function startAndCheck(port, databasePath, token) {
  const child = spawn(nodeExecutable, [serverFile], {
    cwd: path.dirname(serverFile),
    windowsHide: true,
    env: { ...process.env, POS_TEST_DB_PATH: databasePath, POS_BOOTSTRAP_DB: bootstrap, POS_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (child.exitCode !== null) break;
      try { ready = (await fetch(base)).ok; if (ready) break; }
      catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Packaged API did not start: ${stderr}`);
    if (!token) {
      const login = await fetch(`${base}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" }),
      });
      const loginData = await login.json();
      assert.equal(login.status, 200, loginData.message || "Packaged login failed");
      return loginData.token;
    }
    const me = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(me.status, 200, "The saved session must survive an app restart");
    return token;
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
}

(async () => {
  for (const file of [nodeExecutable, serverFile, bootstrap]) assert.ok(fs.existsSync(file), `${file} is missing`);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pos-modern-package-test-"));
  try {
    const databasePath = path.join(directory, "pos-modern.db");
    const port = await freePort();
    const token = await startAndCheck(port, databasePath, null);
    assert.ok(fs.existsSync(databasePath), "First launch must copy the startup database to writable user data");
    const db = new Database(databasePath, { readonly: true });
    try {
      assert.equal(db.prepare("SELECT COUNT(*) count FROM products").get().count, 0);
      assert.equal(db.prepare("SELECT COUNT(*) count FROM customers").get().count, 0);
      assert.equal(db.prepare("SELECT COUNT(*) count FROM suppliers").get().count, 0);
      assert.equal(db.prepare("SELECT COUNT(*) count FROM warehouses").get().count, 1);
      assert.equal(db.prepare("SELECT COUNT(*) count FROM cash_registers").get().count, 1);
      assert.equal(db.prepare("SELECT COUNT(*) count FROM user_warehouses").get().count, 1);
    }
    finally { db.close(); }
    await startAndCheck(port, databasePath, token);
    console.log("Packaged API passed (bootstrap, login, persisted session after restart).");
  } finally {
    if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith("pos-modern-package-test-"))
      fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
