const UPSTREAM =
  "https://cvdlzwralgtapsigyuko.supabase.co/functions/v1/pronti-via";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function upstreamPath(event) {
  const raw = String(event.path || event.rawPath || "");
  let rest = raw
    .replace(/^\/\.netlify\/functions\/proxy/, "")
    .replace(/^\/api/, "");
  const splat = event.pathParameters?.splat || event.params?.splat;
  if ((!rest || rest === "/") && splat) {
    rest = Array.isArray(splat) ? `/${splat.join("/")}` : `/${String(splat).replace(/^\/+/, "")}`;
  }
  if (!rest || rest === "/") return "/";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const target = `${UPSTREAM}${upstreamPath(event)}${
      event.rawQuery ? `?${event.rawQuery}` : ""
    }`;
    const headers = { Accept: "application/json" };
    const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"];
    if (contentType) headers["Content-Type"] = contentType;
    else if (event.body) headers["Content-Type"] = "application/json";
    const auth = event.headers?.authorization || event.headers?.Authorization;
    if (auth) headers.Authorization = auth;

    const upstream = await fetch(target, {
      method: event.httpMethod,
      headers,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
    });
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
      body: text,
    };
  } catch {
    return {
      statusCode: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Proxy API non disponibile." }),
    };
  }
}
