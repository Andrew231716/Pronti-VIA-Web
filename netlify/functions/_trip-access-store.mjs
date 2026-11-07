import { getStore } from "@netlify/blobs";
import { createKv } from "./_store.mjs";

const localWrites = new Map();
let local;

function accessStore() {
  try {
    return getStore({ name: "pronti-via-access-v1", consistency: "strong" });
  } catch (err) {
    // Allow explicitly configured local development. Production must fail closed.
    if (!process.env.PRONTI_KV_DIR || process.env.DEPLOY_ID || process.env.NETLIFY) throw err;
    local ||= createKv("pronti-via-access-v1");
    return null;
  }
}

export async function readAccess(key) {
  const store = accessStore();
  if (store) return store.getWithMetadata(key, { type: "json" });
  const data = await local.getJSON(key);
  return data ? { data } : null;
}

export async function writeAccess(key, data, previous) {
  const store = accessStore();
  if (store) {
    if (previous && !previous.etag) throw new Error("Missing storage version.");
    const conditions = previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true };
    return (await store.setJSON(key, data, conditions)).modified;
  }
  const write = (localWrites.get(key) || Promise.resolve()).then(async () => {
    const current = await local.getJSON(key);
    if (JSON.stringify(current) !== JSON.stringify(previous?.data ?? null)) return false;
    return (await local.setJSON(key, data)).backend === "file";
  });
  const settled = write.catch(() => {});
  localWrites.set(key, settled);
  try {
    return await write;
  } finally {
    if (localWrites.get(key) === settled) localWrites.delete(key);
  }
}
