const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "modern-health-"));
const port = 32000 + Math.floor(Math.random() * 1000);
const child = spawn(
  process.execPath,
  [path.join(__dirname, "..", "server.js")],
  {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      POS_PORT: String(port),
      POS_TEST_DB_PATH: path.join(temporary, "health.sqlite"),
    },
    stdio: "ignore",
  },
);

async function run() {
  let response;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(
    response?.ok,
    "Health endpoint must be reachable without authentication",
  );
  const data = await response.json();
  assert.equal(data.product, "modern-pos-api");
  assert.equal(data.protocol_version, 1);
  assert.equal(data.status, "ok");
  console.log(
    "Connection health integration test passed (compatible unauthenticated endpoint). ",
  );
}

(async () => {
  try {
    await run();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    child.kill();
    if (child.exitCode == null) await once(child, "exit");
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})();
