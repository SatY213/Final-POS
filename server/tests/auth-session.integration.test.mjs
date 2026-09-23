import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = new EventTarget();
const { apiGet, apiRequest, AUTH_EXPIRED_EVENT } = await import("../../src/api/client.js");
const { getStoredSession, setStoredSession } = await import("../../src/utils/session.js");
let expiredEvents = 0;
window.addEventListener(AUTH_EXPIRED_EVENT, () => { expiredEvents += 1; });
const unauthorized = () => ({
  ok: false,
  status: 401,
  json: async () => ({ message: "Session is invalid" }),
});

setStoredSession({ token: "persisted-token", user: { id: 1 } });
const reopenedSessionModule = await import("../../src/utils/session.js?reopened-app");
assert.equal(reopenedSessionModule.getStoredSession().token, "persisted-token", "Closing and reopening the UI must retain the saved token");
globalThis.fetch = async () => { throw new TypeError("API is offline"); };
await assert.rejects(apiGet("/api/auth/me"), /API is offline/);
assert.equal(getStoredSession().token, "persisted-token", "A temporary API outage must not log the user out");

setStoredSession({ token: "old-token", user: { id: 1 } });
globalThis.fetch = async () => unauthorized();
await assert.rejects(apiGet("/api/auth/me"), (error) => error.status === 401);
assert.equal(getStoredSession(), null, "A rejected saved session must be cleared");
assert.equal(expiredEvents, 1, "The app must be notified once to show the login screen");
await assert.rejects(apiGet("/api/auth/me"), (error) => error.status === 401);
assert.equal(expiredEvents, 1, "Concurrent late 401 responses must not log out again");

setStoredSession({ token: "new-token", user: { id: 1 } });
await assert.rejects(apiRequest("/api/auth/login", { auth: false }), (error) => error.status === 401);
assert.equal(getStoredSession().token, "new-token", "A failed login is not a session expiration");
assert.equal(expiredEvents, 1);

let resolveRequest;
globalThis.fetch = () => new Promise((resolve) => { resolveRequest = resolve; });
const oldRequest = apiGet("/api/auth/me");
setStoredSession({ token: "replacement-token", user: { id: 2 } });
resolveRequest(unauthorized());
await assert.rejects(oldRequest, (error) => error.status === 401);
assert.equal(getStoredSession().token, "replacement-token", "A late response cannot log out a newer session");
assert.equal(expiredEvents, 1);

console.log("Session handling passed (reopen, offline API, startup 401, repeated 401, login error and stale response).");
