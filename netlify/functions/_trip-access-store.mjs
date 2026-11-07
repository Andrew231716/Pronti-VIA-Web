import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
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

function blobPath(key) {
  return `trip-access/v1/${key.replace(":", "/")}.json`;
}

export async function readAccess(key) {
  if (process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await get(blobPath(key), { access: "private", useCache: false });
    if (!blob) return null;
    if (blob.statusCode !== 200) throw new Error("Unexpected storage response.");
    return { data: await new Response(blob.stream).json(), etag: blob.blob.etag };
  }
  const store = accessStore();
  if (store) return store.getWithMetadata(key, { type: "json" });
  const data = await local.getJSON(key);
  return data ? { data } : null;
}

export async function writeAccess(key, data, previous) {
  if (process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN) {
    if (previous && !previous.etag) throw new Error("Missing storage version.");
    try {
      await put(blobPath(key), JSON.stringify(data), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: Boolean(previous),
        ifMatch: previous?.etag,
      });
      return true;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError) return false;
      throw err;
    }
  }
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
