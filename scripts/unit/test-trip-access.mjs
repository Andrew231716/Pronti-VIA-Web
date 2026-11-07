import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "pronti-test-"));
process.env.PRONTI_KV_DIR = dir;
const { default: trips } = await import("../../netlify/functions/trips.mjs");
after(() => rmSync(dir, { recursive: true, force: true }));

const token = () => randomBytes(32).toString("hex");
const base = "https://pronti-via-k7es.netlify.app";
async function call(path, method, key, body, extraHeaders) {
  const response = await trips(new Request(`${base}/api/trips/${path}`, {
    method,
    headers: {
      Origin: "https://andrew231716.github.io",
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  }));
  return { status: response.status, data: await response.json() };
}

test("offline publication is idempotent and protects the original trip", async () => {
  const id = `pv-${randomUUID()}`;
  const key = token();
  const viewToken = token();
  const payload = { pvPublish: { id, viewToken }, trip: { title: "Roma", budget: 5000 } };
  const created = await call("publish-offline", "POST", key, payload);
  assert.equal(created.status, 201);
  assert.equal(created.data.id, id);
  assert.equal(created.data.trip.budget, 0);
  const retry = await call("publish-offline", "POST", key, { ...payload, trip: { title: "New draft" } });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.trip.title, "Roma");
  assert.equal((await call("publish-offline", "POST", token(), payload)).status, 403);
  const read = await call(id, "GET", viewToken);
  assert.equal(read.data.canEdit, false);
  assert.equal(read.data.key, undefined);
  assert.equal((await call(id, "PUT", viewToken, { trip: { title: "Changed" }, revision: 1 })).status, 403);
});

test("personal access is scoped, revocable and never returns the owner's credentials", async () => {
  const id = `pv-${randomUUID()}`;
  const key = token();
  const viewToken = token();
  const members = [{ id: "owner-id", name: "Owner" }];
  const trip = { title: "Roma", members, meta: { roles: { "owner-id": "owner" } } };
  await call("publish-offline", "POST", key, { pvPublish: { id, viewToken }, trip });
  assert.equal((await call(`${id}/access`, "POST", viewToken, { name: "Luca", role: "editor" })).status, 403);
  const viewer = await call(`${id}/access`, "POST", key, { name: "Luca", role: "viewer" });
  const editor = await call(`${id}/access`, "POST", key, { name: "Anna", role: "editor" });
  assert.equal(viewer.status, 201);
  assert.equal(editor.status, 201);
  assert.notEqual(viewer.data.token, editor.data.token);
  const read = await call(id, "GET", viewer.data.token);
  assert.equal(read.data.canEdit, false);
  assert.equal(read.data.key, undefined);
  assert.equal(read.data.viewToken, undefined);
  assert.equal((await call(id, "PUT", viewer.data.token, { trip, revision: 1 })).status, 403);
  assert.equal((await call(`${id}/access`, "GET", editor.data.token)).status, 403);
  assert.equal((await call(id, "DELETE", editor.data.token)).status, 403);
  const forged = await call(id, "PUT", editor.data.token, {
    trip: { ...trip, members: [] }, revision: 1, actorMemberId: "owner-id",
  }, { "X-Pronti-Member-Id": "owner-id" });
  assert.equal(forged.status, 403);
  const edited = await call(id, "PUT", editor.data.token, {
    trip: { ...trip, title: "Firenze" }, revision: 1,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.key, undefined);
  assert.equal(edited.data.trip.title, "Firenze");
  assert.deepEqual(edited.data.trip.meta.roles, trip.meta.roles);
  assert.equal((await call(id, "PUT", editor.data.token, { trip, revision: 1 })).status, 409);
  const list = await call(`${id}/access`, "GET", key);
  assert.equal(list.data.invites.length, 2);
  assert.equal(list.data.invites[0].token, undefined);
  assert.equal(list.data.invites[0].hash, undefined);
  assert.equal((await call(`${id}/access`, "DELETE", key, { id: editor.data.id })).status, 200);
  assert.equal((await call(id, "GET", editor.data.token)).status, 403);
  const history = await call(`${id}/access`, "GET", key);
  assert.equal(history.data.revoked.length, 1);
  assert.equal(history.data.revoked[0].id, editor.data.id);
  assert.equal(history.data.revoked[0].hash, undefined);
  assert.equal((await call(id, "GET", viewer.data.token)).status, 200);
  assert.equal((await call(id, "GET", key)).data.trip.title, "Firenze");
});
