import { handler } from "../netlify/functions/trips.mjs";
import { readAccess } from "../netlify/functions/_trip-access-store.mjs";

const tripPath = /^\/api\/trips\/[a-zA-Z0-9_-]{1,128}(?:\/(?:access|files)(?:\/[a-zA-Z0-9_-]{1,128})?)?$/;

export default async function tripAccess(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.searchParams.get("health") === "1" && req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    try {
      await readAccess("health");
      return res.status(200).json({ service: "pronti-via-trip-access", storage: "ready" });
    } catch {
      return res.status(503).json({ service: "pronti-via-trip-access", storage: "unavailable" });
    }
  }
  const path = url.searchParams.get("path") || "";
  if (!tripPath.test(path)) return res.status(400).json({ error: "Percorso viaggio non valido." });
  const result = await handler({
    httpMethod: req.method,
    headers: req.headers,
    path,
    body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
    vercelAccess: true,
  });
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  return res.status(result.statusCode).end(result.body);
}
