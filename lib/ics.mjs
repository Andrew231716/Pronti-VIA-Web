/** Minimal ICS builder (no paid calendar APIs). */

function pad(n) {
  return String(n).padStart(2, "0");
}

export function toIcsDate(dateStr) {
  const d = String(dateStr || "").replace(/-/g, "").slice(0, 8);
  if (!/^\d{8}$/.test(d)) return null;
  return d;
}

export function toIcsStamp(date = new Date()) {
  const x = date instanceof Date ? date : new Date(date);
  return (
    x.getUTCFullYear() +
    pad(x.getUTCMonth() + 1) +
    pad(x.getUTCDate()) +
    "T" +
    pad(x.getUTCHours()) +
    pad(x.getUTCMinutes()) +
    pad(x.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildTripEvents(trip) {
  const events = [];
  const title = trip?.title || "Viaggio";
  if (trip?.start) {
    events.push({
      uid: `start-${trip.id || "trip"}@pronti-via`,
      summary: `Partenza: ${title}`,
      start: trip.start,
      end: trip.start,
      description: trip.destination || "",
    });
  }
  if (trip?.end) {
    events.push({
      uid: `end-${trip.id || "trip"}@pronti-via`,
      summary: `Ritorno: ${title}`,
      start: trip.end,
      end: trip.end,
      description: trip.destination || "",
    });
  }
  for (const b of trip?.bookings || []) {
    const day = b.date || b.start || b.checkIn;
    if (!day) continue;
    events.push({
      uid: `book-${b.id || day}@pronti-via`,
      summary: b.title || b.name || "Prenotazione",
      start: day,
      end: b.checkOut || b.end || day,
      description: b.notes || b.url || "",
    });
  }
  for (const s of trip?.stops || []) {
    const day = s.date || s.day || trip.start;
    if (!day) continue;
    events.push({
      uid: `stop-${s.id || s.title}@pronti-via`,
      summary: s.title || s.name || "Tappa",
      start: typeof day === "string" && day.length >= 10 ? day.slice(0, 10) : trip.start,
      end: typeof day === "string" && day.length >= 10 ? day.slice(0, 10) : trip.start,
      description: [s.address, s.notes].filter(Boolean).join(" — "),
    });
  }
  for (const r of trip?.meta?.reminders || []) {
    if (!r.date) continue;
    events.push({
      uid: `rem-${r.id || r.date}@pronti-via`,
      summary: r.title || "Promemoria",
      start: r.date,
      end: r.date,
      description: r.notes || "",
    });
  }
  return events;
}

export function buildIcs(events, { calendarName = "Pronti? VIA!" } = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pronti VIA//IT",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const ev of events || []) {
    const start = toIcsDate(ev.start);
    if (!start) continue;
    let end = toIcsDate(ev.end) || start;
    // All-day DTEND is exclusive → +1 day if same
    if (end === start) {
      const y = Number(start.slice(0, 4));
      const m = Number(start.slice(4, 6)) - 1;
      const d = Number(start.slice(6, 8));
      const dt = new Date(Date.UTC(y, m, d + 1));
      end = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
    }
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(ev.uid || `${start}@pronti-via`)}`,
      `DTSTAMP:${toIcsStamp()}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeText(ev.summary || "Evento")}`,
      `DESCRIPTION:${escapeText(ev.description || "")}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
