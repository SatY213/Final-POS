/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const skipped = new Set([
  "node_modules",
  "dist",
  ".git",
  "backups",
  "build-runtime",
  "build-install",
  "build-demo",
  "out",
]);
function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (skipped.has(entry.name)) return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(target);
    return entry.isFile() && entry.name.endsWith(".js") && target.includes(`${path.sep}server${path.sep}`)
      ? [target]
      : [];
  });
}

const failures = [];
for (const file of collect(root)) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push({ file, output: result.stderr || result.stdout });
}
if (failures.length) {
  failures.forEach(({ file, output }) => console.error(`${path.relative(root, file)}\n${output}`));
  process.exitCode = 1;
} else {
  console.log("Server JavaScript syntax check passed.");
}
