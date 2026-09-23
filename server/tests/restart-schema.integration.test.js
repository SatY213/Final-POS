const assert = require("node:assert/strict");
const db = require("../config/database");
const migrationPath = require.resolve("../database/migrations/init");
require(migrationPath);

let complete = false;
try {
  db.transaction(() => {
    db.prepare(
      "INSERT OR IGNORE INTO document_sequences(document_type,current_value) VALUES('DELIVERY_NOTE',0)",
    ).run();
    db.prepare(
      "INSERT OR IGNORE INTO document_sequences(document_type,current_value) VALUES('SALE_INVOICE',0)",
    ).run();
    db.prepare(
      "UPDATE document_sequences SET current_value=117 WHERE document_type IN ('DELIVERY_NOTE','SALE_INVOICE')",
    ).run();
    db.prepare(
      "UPDATE print_profiles SET copies=3 WHERE document_type='SALE_INVOICE'",
    ).run();

    delete require.cache[migrationPath];
    require(migrationPath);

    const sequences = db.prepare(
      "SELECT document_type,current_value FROM document_sequences WHERE document_type IN ('DELIVERY_NOTE','SALE_INVOICE') ORDER BY document_type",
    ).all();
    assert.equal(sequences.length, 2);
    assert.ok(sequences.every((item) => item.current_value === 117));
    assert.equal(
      db.prepare("SELECT copies FROM print_profiles WHERE document_type='SALE_INVOICE'").get().copies,
      3,
    );
    complete = true;
    throw new Error("ROLLBACK_TEST");
  })();
} catch (error) {
  if (error.message !== "ROLLBACK_TEST") throw error;
}

assert.equal(complete, true);
console.log("Restart schema integration test passed (sequences and print preferences preserved).");
