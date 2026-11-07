import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("recovery rotates the code, revokes sessions and keeps the trip list", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pv-recovery-"));
  process.env.PRONTI_KV_DIR = dir;
  try {
    const { default: handler } = await import("../../api/recovery-account.mjs");
    const username = "traveler@via";
    async function call(action, { method = "POST", token, ...body } = {}) {
      let status, data;
      await handler({
        method, url: `/api/recovery-account?action=${action}`,
        headers: { authorization: token ? `Bearer ${token}` : "", origin: "https://andrew231716.github.io" },
        body: { action, username, ...body },
      }, {
        setHeader() {},
        status(value) { status = value; return this; },
        json(value) { data = value; },
      });
      return { status, data };
    }
    const registered = await call("register", { password: "Original123" });
    assert.equal(registered.status, 201);
    const { token, recoveryCode } = registered.data;
    assert.match(recoveryCode, /^[a-f0-9]{40}$/);
    const trips = [{ id: "roma", key: "trip-key", title: "Roma" }];
    assert.equal((await call("save-trips", { method: "PUT", token, trips })).status, 200);
    assert.equal((await call("reset", { password: "Changed123", code: "f".repeat(40) })).status, 401);
    const recovered = await call("reset", { password: "Changed123", code: recoveryCode });
    assert.equal(recovered.status, 200);
    assert.notEqual(recovered.data.recoveryCode, recoveryCode);
    assert.deepEqual(recovered.data.trips, trips);
    assert.equal((await call("me", { method: "GET", token })).status, 401);
    assert.equal((await call("reset", { password: "Changed456", code: recoveryCode })).status, 401);
    assert.equal((await call("login", { password: "Original123" })).status, 401);
    const login = await call("login", { password: "Changed123" });
    assert.equal(login.status, 200);
    assert.deepEqual(login.data.trips, trips);
    assert.equal(login.data.recoveryCode, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
