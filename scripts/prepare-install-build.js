const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outputDirectory = path.join(root, "build-install");
const databasePath = path.join(outputDirectory, "pos-modern.db");
if (
  path.dirname(databasePath) !== outputDirectory ||
  path.dirname(outputDirectory) !== root ||
  path.basename(outputDirectory) !== "build-install"
)
  throw new Error("Unsafe installation staging path");
fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

const initialize = spawnSync(
  process.execPath,
  [path.join(root, "server/database/verify-clean-install.js")],
  {
    cwd: root,
    env: { ...process.env, POS_TEST_DB_PATH: databasePath },
    stdio: "inherit",
    timeout: 180_000,
  },
);
if (initialize.error || initialize.status !== 0)
  throw initialize.error || new Error(`Clean database preparation failed (${initialize.status})`);

if (process.platform === "win32") {
  const icon = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "scripts/build-icon.ps1")],
    { cwd: root, stdio: "inherit", timeout: 30_000 },
  );
  if (icon.error || icon.status !== 0)
    throw icon.error || new Error(`Icon generation failed (${icon.status})`);
}

const runtimeDirectory = path.join(root, "build-runtime");
if (
  path.dirname(runtimeDirectory) !== root ||
  path.basename(runtimeDirectory) !== "build-runtime"
)
  throw new Error("Unsafe runtime staging path");
fs.rmSync(runtimeDirectory, { recursive: true, force: true });
fs.mkdirSync(runtimeDirectory, { recursive: true });
fs.copyFileSync(process.execPath, path.join(runtimeDirectory, "node.exe"));
const nodeLicense = path.join(path.dirname(process.execPath), "LICENSE");
if (fs.existsSync(nodeLicense))
  fs.copyFileSync(nodeLicense, path.join(runtimeDirectory, "NODE-LICENSE"));
const sourceServer = path.join(root, "server");
fs.cpSync(sourceServer, path.join(runtimeDirectory, "server"), {
  recursive: true,
  filter(source) {
    const relative = path.relative(sourceServer, source).replaceAll("\\", "/");
    return !(
      /^(?:backups|tests)(?:\/|$)/.test(relative) ||
      /^config\/pos-modern\.db(?:-wal|-shm)?$/.test(relative) ||
      /^database\/(?:reset-and-seed|verify-clean-install)\.js$/.test(relative)
    );
  },
});
console.log(`Clean installer database prepared: ${databasePath}`);
