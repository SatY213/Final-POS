import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const ACTIVATION_API_URL =
  "https://initial-go.vercel.app/api/software-subs/activate";
export const LICENSE_PRODUCT = "moderna-pos";
export const LICENSE_FILE = "license.json";
export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAKC4Ozpvjgt0EtuxL72C1Xv3yCdoW8H4QOWi6+zxJQas=
-----END PUBLIC KEY-----`;

const UID_PATTERN = /^[a-f0-9]{4}(?:-[a-f0-9]{4}){4}$/i;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const PLACEHOLDERS = new Set([
  "",
  "defaultstring",
  "tobefilledbyo.e.m.",
  "tobefilledbyoem",
  "none",
  "unknown",
  "notapplicable",
]);

function normalizeIdentifier(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function fingerprintFromIdentifiers(identifiers) {
  const values = Object.entries(identifiers || {})
    .map(([name, value]) => [name, normalizeIdentifier(value)])
    .filter(([, value]) => value && !PLACEHOLDERS.has(value))
    .sort(([left], [right]) => left.localeCompare(right));
  if (!values.length)
    throw new Error("No stable machine identifier is available");
  return crypto
    .createHash("sha256")
    .update(values.map(([name, value]) => `${name}:${value}`).join("\n"))
    .digest("hex");
}

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function windowsIdentifiers() {
  const registry = commandOutput("reg.exe", [
    "query",
    "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
    "/v",
    "MachineGuid",
  ]);
  const machineGuid = registry.match(/MachineGuid\s+REG_\w+\s+([^\r\n]+)/i)?.[1];
  const hardware = commandOutput("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "$ErrorActionPreference='SilentlyContinue';$c=Get-CimInstance Win32_ComputerSystemProduct;$b=Get-CimInstance Win32_BaseBoard;$d=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\";[Console]::Out.Write(($c.UUID)+'|'+($b.SerialNumber)+'|'+($d.VolumeSerialNumber))",
  ]).split("|");
  return {
    machineGuid,
    systemUuid: hardware[0],
    baseboardSerial: hardware[1],
    systemDriveSerial: hardware[2],
  };
}

function unixIdentifiers() {
  let machineId = "";
  for (const candidate of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    try {
      machineId = fs.readFileSync(candidate, "utf8").trim();
      if (machineId) break;
    } catch {
      // Try the next OS-owned identifier.
    }
  }
  return { machineId };
}

export function getDeviceFingerprint() {
  return fingerprintFromIdentifiers(
    process.platform === "win32" ? windowsIdentifiers() : unixIdentifiers(),
  );
}

function decodePayload(encoded) {
  const raw = Buffer.from(encoded, "base64url").toString("utf8");
  const payload = JSON.parse(raw);
  if (!payload || typeof payload !== "object") throw new Error("Invalid payload");
  return payload;
}

export function validateLicenseEnvelope(
  envelope,
  deviceFingerprint,
  { publicKey = LICENSE_PUBLIC_KEY, now = Date.now() } = {},
) {
  try {
    if (
      envelope?.algorithm !== "Ed25519" ||
      typeof envelope.payload !== "string" ||
      typeof envelope.signature !== "string"
    )
      return { valid: false, reason: "malformed" };
    const verified = crypto.verify(
      null,
      Buffer.from(envelope.payload, "utf8"),
      publicKey,
      Buffer.from(envelope.signature, "base64url"),
    );
    if (!verified) return { valid: false, reason: "signature" };
    const payload = decodePayload(envelope.payload);
    if (
      payload.version !== 1 ||
      payload.product !== LICENSE_PRODUCT ||
      !FINGERPRINT_PATTERN.test(String(payload.deviceFingerprint || ""))
    )
      return { valid: false, reason: "malformed" };
    if (payload.deviceFingerprint !== deviceFingerprint)
      return { valid: false, reason: "device_mismatch" };
    if (payload.expiresAt && Date.parse(payload.expiresAt) <= now)
      return { valid: false, reason: "expired" };
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: "corrupted" };
  }
}

function activationError(status, response) {
  const apiMessage = String(response?.message || "").trim();
  if (status === 404 || status === 400)
    return { code: "invalid_code", message: apiMessage };
  if (status === 409)
    return { code: "device_limit", message: apiMessage };
  if (status === 403 || status === 410)
    return { code: "inactive_or_expired", message: apiMessage };
  if (status === 429) return { code: "rate_limited", message: apiMessage };
  return { code: "server_unavailable", message: apiMessage };
}

export function createLicensingService({
  userDataPath,
  appVersion,
  fetchImpl = globalThis.fetch,
  fingerprintProvider = getDeviceFingerprint,
  publicKey = LICENSE_PUBLIC_KEY,
  activationUrl = ACTIVATION_API_URL,
  timeoutMs = 10_000,
}) {
  const licensePath = path.join(userDataPath, LICENSE_FILE);
  let cachedFingerprint;
  const getFingerprint = () => {
    if (!cachedFingerprint) cachedFingerprint = fingerprintProvider();
    return cachedFingerprint;
  };

  function readStoredLicense() {
    try {
      return JSON.parse(fs.readFileSync(licensePath, "utf8"));
    } catch {
      return null;
    }
  }

  function clearInvalidLicense() {
    try {
      fs.rmSync(licensePath, { force: true });
    } catch {
      // A missing/unreadable proof is already invalid.
    }
  }

  function storeLicense(envelope) {
    fs.mkdirSync(path.dirname(licensePath), { recursive: true });
    const temporary = `${licensePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(envelope, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(temporary, licensePath);
  }

  function validateLocalLicense() {
    let fingerprint;
    try {
      fingerprint = getFingerprint();
    } catch {
      return { valid: false, reason: "fingerprint_unavailable" };
    }
    const envelope = readStoredLicense();
    if (!envelope) return { valid: false, reason: "missing" };
    const result = validateLicenseEnvelope(envelope, fingerprint, { publicKey });
    if (!result.valid) clearInvalidLicense();
    return result;
  }

  async function activate(inputCode) {
    const uid = String(inputCode || "").trim();
    if (!UID_PATTERN.test(uid))
      return { ok: false, code: "invalid_code" };
    let fingerprint;
    try {
      fingerprint = getFingerprint();
    } catch {
      return { ok: false, code: "fingerprint_unavailable" };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(activationUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          deviceFingerprint: fingerprint,
          product: LICENSE_PRODUCT,
          version: appVersion,
        }),
        signal: controller.signal,
      });
      let data;
      try {
        data = await response.json();
      } catch {
        return { ok: false, code: "malformed_response" };
      }
      if (!response.ok) return { ok: false, ...activationError(response.status, data) };
      const envelope = data?.license || data?.data?.license;
      const validation = validateLicenseEnvelope(envelope, fingerprint, {
        publicKey,
      });
      if (!validation.valid)
        return { ok: false, code: "invalid_license_response" };
      storeLicense(envelope);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        code: error?.name === "AbortError" ? "timeout" : "network_error",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    activate,
    clearInvalidLicense,
    getDeviceFingerprint: getFingerprint,
    getStoredLicense: readStoredLicense,
    licensePath,
    validateLocalLicense,
  };
}
