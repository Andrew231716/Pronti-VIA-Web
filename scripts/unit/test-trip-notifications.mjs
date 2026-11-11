import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import webPush from "web-push";

const directory = mkdtempSync(join(tmpdir(), "pv-notifications-"));
process.env.PRONTI_KV_DIR = directory;
const { handler } = await import("../../netlify/functions/trips.mjs");
const { default: notifications } = await import("../../api/trip-notifications.mjs");
const pushOriginal = webPush.sendNotification;
after(() => {
  webPush.sendNotification = pushOriginal;
  rmSync(directory, { recursive: true, force: true });
});

async function tripRequest(method, path, key, body) {
  const response = await handler({
    httpMethod: method, path: `/api/trips/${path}`, headers: { authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

async function pushRequest(key, body) {
  let code;
  let result;
  await notifications({ method: body ? "POST" : "GET", headers: { authorization: `Bearer ${key}` }, body }, {
    setHeader() {},
    status(status) { code = status; return this; },
    json(data) { result = data; },
  });
  return { status: code, body: result };
}

test("trip pushes respect preferences, current debts, revisions and revoked invitations", async () => {
  const delivered = [];
  webPush.sendNotification = async (subscription, payload) => {
    delivered.push({ endpoint: subscription.endpoint, ...JSON.parse(payload) });
  };
  const tripId = `pv-${randomUUID()}`;
  const owner = randomBytes(32).toString("hex");
  const viewToken = randomBytes(32).toString("hex");
  const trip = {
    title: "Roma",
    members: [{ id: "anna", name: "Anna" }, { id: "luca", name: "Luca" }],
    expenses: [{ payer: "anna", amount: 1200, shares: [{ member: "anna", amount: 600 }, { member: "luca", amount: 600 }] }],
  };
  assert.equal((await tripRequest("POST", "publish-offline", owner, { pvPublish: { id: tripId, viewToken }, trip })).status, 201);
  const invite = (await tripRequest("POST", `${tripId}/access`, owner, { name: "Luca", role: "viewer" })).body;
  const vapid = await pushRequest(owner);
  assert.equal(vapid.status, 200);
  assert.deepEqual(await pushRequest(owner), vapid);
  assert.deepEqual(Object.keys(vapid.body), ["publicKey"]);

  const deviceId = randomUUID();
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/fixture",
    keys: { p256dh: randomBytes(65).toString("base64url"), auth: randomBytes(16).toString("base64url") },
  };
  const sub = { action: "subscribe", tripId, deviceId, subscription, updates: true, expenses: true };
  assert.equal((await pushRequest(invite.token, { ...sub, subscription: { ...subscription, endpoint: "https://example.org/" } })).status, 400);
  assert.deepEqual((await pushRequest(invite.token, { ...sub, name: "Anna" })).body, { ok: true, linked: true });
  const reminder = { action: "reminder", tripId, from: "luca", to: "anna" };
  assert.equal((await pushRequest(viewToken, reminder)).status, 403);
  assert.equal((await pushRequest(owner, { ...reminder, from: "anna", to: "luca" })).status, 409);
  assert.equal((await pushRequest(owner, reminder)).body.sent, 1);
  assert.equal((await pushRequest(owner, reminder)).status, 429);

  assert.equal((await tripRequest("PUT", tripId, owner, { trip: { ...trip, title: "Firenze" }, revision: 1 })).status, 200);
  const change = { action: "change", tripId };
  assert.equal((await pushRequest(owner, change)).body.sent, 1);
  assert.equal((await pushRequest(owner, change)).body.sent, 0);
  assert.equal(delivered.length, 2);
  assert.deepEqual(delivered.map(item => item.kind), ["reminder", "change"]);
  assert.ok(delivered.every(item => !("key" in item) && !("amount" in item)));

  assert.equal((await tripRequest("DELETE", `${tripId}/access`, owner, { id: invite.id })).status, 200);
  assert.equal((await tripRequest("PUT", tripId, owner, { trip: { ...trip, title: "Pisa" }, revision: 2 })).status, 200);
  assert.equal((await pushRequest(owner, change)).body.sent, 0);
  assert.equal((await pushRequest(owner, reminder)).body.sent, 0);
  assert.equal((await pushRequest(invite.token, sub)).status, 403);
  assert.equal((await pushRequest(invite.token, { action: "disable", tripId, deviceId })).status, 200);
});
