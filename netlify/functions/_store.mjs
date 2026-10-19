/**
 * KV for trips/share: Netlify Blobs when configured, else durable file store
 * (local/tunnel/dev), else in-memory.
 */
import { getStore } from "@netlify/blobs";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.env.PRONTI_KV_DIR || join(tmpdir(), "pronti-via-kv");

function ensureRoot() {
  try {
    mkdirSync(ROOT, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function filePath(storeName, key) {
  const safe = String(key).replace(/[^a-zA-Z0-9._:-]+/g, "_");
  return join(ROOT, `${storeName}__${safe}.json`);
}

function tryGetBlobs(name) {
  try {
    const siteID =
      process.env.SITE_ID || process.env.NETLIFY_SITE_ID || process.env.BLOBS_SITE_ID;
    const token =
      process.env.NETLIFY_BLOBS_TOKEN ||
      process.env.NETLIFY_API_TOKEN ||
      process.env.BLOBS_TOKEN ||
      process.env.NETLIFY_AUTH_TOKEN;
    if (siteID && token) return getStore({ name, siteID, token });
    if (process.env.NETLIFY || process.env.CONTEXT || process.env.DEPLOY_ID) {
      return getStore(name);
    }
  } catch {
    /* ignore */
  }
  return null;
}

const mem = new Map();

export function createKv(storeName) {
  const blobs = tryGetBlobs(storeName);
  const filesOk = ensureRoot();

  return {
    async getJSON(key) {
      if (blobs) {
        try {
          const v = await blobs.get(key, { type: "json" });
          if (v != null) return v;
        } catch {
          /* fall through */
        }
      }
      const mk = `${storeName}:${key}`;
      if (mem.has(mk)) return mem.get(mk);
      if (filesOk) {
        try {
          const p = filePath(storeName, key);
          if (existsSync(p)) {
            const json = JSON.parse(readFileSync(p, "utf8"));
            mem.set(mk, json);
            return json;
          }
        } catch {
          /* ignore */
        }
      }
      return null;
    },

    async setJSON(key, value) {
      const mk = `${storeName}:${key}`;
      mem.set(mk, value);
      if (blobs) {
        try {
          await blobs.setJSON(key, value);
          return { backend: "blobs" };
        } catch {
          /* fall through */
        }
      }
      if (filesOk) {
        try {
          writeFileSync(filePath(storeName, key), JSON.stringify(value));
          return { backend: "file" };
        } catch {
          /* fall through */
        }
      }
      return { backend: "memory" };
    },
  };
}
