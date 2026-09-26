const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "modern-print-settings-test-"),
);
process.env.POS_TEST_DB_PATH = path.join(directory, "settings.db");
const db = require("../config/database");
const Settings = require("../services/settings.service");

try {
  db.exec(
    "CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT, value_type TEXT, updated_by INTEGER, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  );
  assert.equal(Settings.getGroup("purchases").default_print_format, "NONE");
  assert.equal(
    Settings.updateGroup("sales", { default_print_format: "NONE" }, { id: 1 })
      .default_print_format,
    "NONE",
  );
  assert.equal(
    Settings.updateGroup("purchases", { default_print_format: "A4" }, { id: 1 })
      .default_print_format,
    "A4",
  );
  assert.equal(
    Settings.updateGroup(
      "purchases",
      { default_print_format: "NONE" },
      { id: 1 },
    ).default_print_format,
    "NONE",
  );
  assert.throws(
    () =>
      Settings.updateGroup(
        "sales",
        { default_print_format: "INVALID" },
        { id: 1 },
      ),
    /invalid/,
  );
  console.log(
    "Print preferences passed (sales/purchases no-print option and valid formats).",
  );
} finally {
  db.close();
  if (
    path.dirname(directory) === os.tmpdir() &&
    path.basename(directory).startsWith("modern-print-settings-test-")
  )
    fs.rmSync(directory, { recursive: true, force: true });
}
