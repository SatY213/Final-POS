const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outputRoot = path.join(root, "api-server-usb");
const ubuntuOutput = path.join(outputRoot, "ubuntu");
const windowsOutput = path.join(outputRoot, "windows");

if (
  path.dirname(outputRoot) !== root ||
  path.basename(outputRoot) !== "api-server-usb"
)
  throw new Error("Unsafe API server USB output path");

fs.mkdirSync(ubuntuOutput, { recursive: true });
fs.mkdirSync(windowsOutput, { recursive: true });

const ubuntuServerOutput = path.join(ubuntuOutput, "server");
fs.rmSync(ubuntuServerOutput, { recursive: true, force: true });

const serverSource = path.join(root, "server");
fs.cpSync(serverSource, ubuntuServerOutput, {
  recursive: true,
  filter(source) {
    const relative = path.relative(serverSource, source).replaceAll("\\", "/");
    return !(
      /^(?:node_modules|tests|backups)(?:\/|$)/.test(relative) ||
      /^config\/pos-modern\.db(?:-wal|-shm)?$/.test(relative) ||
      /^\.env(?:\.|$)/.test(relative)
    );
  },
});

const windowsRuntime = path.join(root, "build-runtime");
const windowsRuntimeOutput = path.join(windowsOutput, "build-runtime");
fs.rmSync(windowsRuntimeOutput, { recursive: true, force: true });
const missingRuntimeNotice = path.join(windowsOutput, "BUILD_RUNTIME_MISSING.txt");
fs.rmSync(missingRuntimeNotice, { force: true });
if (fs.existsSync(path.join(windowsRuntime, "node.exe"))) {
  fs.cpSync(windowsRuntime, windowsRuntimeOutput, {
    recursive: true,
  });
} else {
  fs.writeFileSync(
    missingRuntimeNotice,
    "Executez npm run make, puis relancez npm run prepare:api-server-usb.\r\n",
  );
}

console.log(`Ubuntu USB folder ready: ${ubuntuOutput}`);
console.log(`Windows USB folder ready: ${windowsOutput}`);
