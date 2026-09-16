const TRIPS_BASE =
  "https://cvdlzwralgtapsigyuko.supabase.co/functions/v1/pronti-via";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function tripsPath(event) {
  const raw = String(event.path || "");
  let rest = raw
    .replace(/^\/\.netlify\/functions\/trips/, "")
    .replace(/^\/api\/trips/, "")
    .replace(/^\/api/, "");
  if (!rest || rest === "/") return "/trips";
  if (!rest.startsWith("/")) rest = `/${rest}`;
  return `/trips${rest}`;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const target = `${TRIPS_BASE}${tripsPath(event)}${
      event.rawQuery ? `?${event.rawQuery}` : ""
    }`;

    const headers = { "Content-Type": "application/json" };
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
      body: JSON.stringify({ error: "Proxy viaggi non disponibile." }),
    };
  }
}
