/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const directory = __dirname;
const files = fs.readdirSync(directory)
  .filter((name) => /\.integration\.test\.(?:js|mjs)$/.test(name))
  .sort();
const results = [];

const compactOutput = (value) => {
  const lines = String(value || "").trim().split(/\r?\n/).filter(Boolean);
  const kept = lines.slice(-30);
  return `${lines.length > kept.length ? `[... ${lines.length - kept.length} lines omitted ...]\n` : ""}${kept.join("\n")}`;
};

for (const file of files) {
  const result = spawnSync(process.execPath, [path.join(directory, file)], {
    cwd: path.resolve(directory, ".."),
    encoding: "utf8",
    timeout: 60_000,
  });
  const passed = result.status === 0;
  results.push({ file, passed });
  console.log(`${passed ? "PASS" : "FAIL"} ${file}`);
  if (!passed) {
    if (result.stdout) console.error(compactOutput(result.stdout));
    if (result.stderr) console.error(compactOutput(result.stderr));
    if (result.error) console.error(result.error.message);
  }
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} integration tests passed.`);
if (failed.length) {
  console.error(`Failed: ${failed.map((result) => result.file).join(", ")}`);
  process.exitCode = 1;
}
