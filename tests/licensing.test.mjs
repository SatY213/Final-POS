import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  LICENSE_PRODUCT,
  createLicensingService,
  fingerprintFromIdentifiers,
  validateLicenseEnvelope,
} from "../src/licensing/licenseService.mjs";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
const fingerprintA = "a".repeat(64);
const fingerprintB = "b".repeat(64);

function signLicense(overrides = {}) {
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      product: LICENSE_PRODUCT,
      subscriptionId: "subscription-test",
      deviceFingerprint: fingerprintA,
      issuedAt: "2026-09-25T12:00:00.000Z",
      expiresAt: null,
      ...overrides,
    }),
  ).toString("base64url");
  return {
    algorithm: "Ed25519",
    payload,
    signature: crypto.sign(null, Buffer.from(payload), privateKey).toString("base64url"),
  };
}

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "moderna-license-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("fingerprint is stable, normalized and does not expose raw identifiers", () => {
  const first = fingerprintFromIdentifiers({ machineGuid: " ABC-123 ", systemUuid: "UUID-1" });
  const second = fingerprintFromIdentifiers({ systemUuid: "uuid1", machineGuid: "abc123" });
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first.includes("abc"), false);
});

test("signed proof validates only for its device", () => {
  const envelope = signLicense();
  assert.equal(validateLicenseEnvelope(envelope, fingerprintA, { publicKey: publicKeyPem }).valid, true);
  assert.deepEqual(
    validateLicenseEnvelope(envelope, fingerprintB, { publicKey: publicKeyPem }),
    { valid: false, reason: "device_mismatch" },
  );
});

test("tampered and expired proofs are rejected", () => {
  const tampered = signLicense();
  tampered.payload = Buffer.from(JSON.stringify({ product: LICENSE_PRODUCT })).toString("base64url");
  assert.equal(validateLicenseEnvelope(tampered, fingerprintA, { publicKey: publicKeyPem }).valid, false);
  const expired = signLicense({ expiresAt: "2025-01-01T00:00:00.000Z" });
  assert.deepEqual(
    validateLicenseEnvelope(expired, fingerprintA, { publicKey: publicKeyPem, now: Date.parse("2026-01-01") }),
    { valid: false, reason: "expired" },
  );
});

test("activation stores a verifiable offline proof and restart remains activated", async (t) => {
  const directory = temporaryDirectory(t);
  let requestBody;
  const service = createLicensingService({
    userDataPath: directory,
    appVersion: "1.0.1",
    fingerprintProvider: () => fingerprintA,
    publicKey: publicKeyPem,
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ success: true, license: signLicense() }) };
    },
  });
  assert.deepEqual(await service.activate(" 1017-edd8-f67d-ca50-e3f4 "), { ok: true });
  assert.equal(requestBody.uid, "1017-edd8-f67d-ca50-e3f4");
  assert.equal(requestBody.deviceFingerprint, fingerprintA);
  const restartedOffline = createLicensingService({
    userDataPath: directory,
    appVersion: "1.0.1",
    fingerprintProvider: () => fingerprintA,
    publicKey: publicKeyPem,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(restartedOffline.validateLocalLicense().valid, true);
});

test("copied or corrupted license cannot activate another device", async (t) => {
  const directory = temporaryDirectory(t);
  fs.writeFileSync(path.join(directory, "license.json"), JSON.stringify(signLicense()));
  const copied = createLicensingService({
    userDataPath: directory,
    appVersion: "1.0.1",
    fingerprintProvider: () => fingerprintB,
    publicKey: publicKeyPem,
  });
  assert.equal(copied.validateLocalLicense().reason, "device_mismatch");
  assert.equal(fs.existsSync(path.join(directory, "license.json")), false);
  fs.writeFileSync(path.join(directory, "license.json"), "not-json");
  assert.equal(copied.validateLocalLicense().valid, false);
});

test("invalid code and unavailable server never unlock the installation", async (t) => {
  const directory = temporaryDirectory(t);
  const service = createLicensingService({
    userDataPath: directory,
    appVersion: "1.0.1",
    fingerprintProvider: () => fingerprintA,
    publicKey: publicKeyPem,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.deepEqual(await service.activate("wrong"), { ok: false, code: "invalid_code" });
  assert.deepEqual(await service.activate("1017-edd8-f67d-ca50-e3f4"), { ok: false, code: "network_error" });
  assert.equal(service.validateLocalLicense().valid, false);
});
