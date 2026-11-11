/**
 * Personal flight booking lookup — POST /api/flight-booking
 * Body: { airline, pnr, lastName?, flightNumber? }
 */

import { corsHeadersFor } from "../../lib/cors.mjs";
import { lookupFlightBooking, validateLookupInput } from "../../lib/flight-booking-lookup.mjs";

function json(status, body, corsHeaders) {
  return {
    statusCode: status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

export async function handler(event) {
  const corsHeaders = corsHeadersFor(event, {
    methods: "GET, POST, OPTIONS",
    headers: "Content-Type, Authorization",
  });
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod === "GET") {
    return json(
      200,
      {
        ok: true,
        service: "flight-booking",
        usage: "POST { airline, pnr, lastName?, flightNumber? }",
        live: Boolean(process.env.AVIATIONSTACK_ACCESS_KEY),
      },
      corsHeaders
    );
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Metodo non supportato." }, corsHeaders);
  }

  try {
    const input = validateLookupInput(parseBody(event));
    const result = await lookupFlightBooking({
      ...input,
      accessKey: process.env.AVIATIONSTACK_ACCESS_KEY || "",
    });
    return json(200, result, corsHeaders);
  } catch (err) {
    const status = err?.code === "AIRLINE_UNKNOWN" || err?.code === "PNR_INVALID" ? 400 : 500;
    return json(status, { error: err?.message || "Ricerca prenotazione non riuscita." }, corsHeaders);
  }
}
