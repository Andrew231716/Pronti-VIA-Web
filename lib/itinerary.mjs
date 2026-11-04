/**
 * Stop helpers + greedy nearest-neighbor optimization (no paid routing API).
 * Distance: haversine km. Manual order always wins after user edits.
 */

const R = 6371;

export function haversineKm(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return Infinity;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function stopCoords(s) {
  const lat = Number(s.lat ?? s.latitude ?? s.coords?.lat);
  const lng = Number(s.lng ?? s.lon ?? s.longitude ?? s.coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Greedy NN within a day group. Locked/confirmed stops keep relative anchors. */
export function optimizeStops(stops, { transport = "walk" } = {}) {
  const list = (stops || []).map((s, i) => ({ ...s, __i: i }));
  const byDay = new Map();
  for (const s of list) {
    const day = String(s.day ?? s.date ?? "0");
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(s);
  }
  const speed = transport === "car" ? 40 : transport === "transit" ? 25 : 5; // km/h rough
  const out = [];
  const report = [];
  for (const [day, group] of byDay) {
    const fixed = group.filter((s) => s.optional === false && (s.confirmed || s.locked));
    const movable = group.filter((s) => !fixed.includes(s));
    const withCoord = movable.filter((s) => stopCoords(s));
    const noCoord = movable.filter((s) => !stopCoords(s));
    const ordered = [];
    if (withCoord.length) {
      let current = withCoord[0];
      const left = new Set(withCoord.slice(1));
      ordered.push(current);
      while (left.size) {
        let best = null;
        let bestD = Infinity;
        for (const s of left) {
          const d = haversineKm(stopCoords(current), stopCoords(s));
          if (d < bestD) {
            bestD = d;
            best = s;
          }
        }
        left.delete(best);
        ordered.push(best);
        current = best;
      }
    }
    const dayOrdered = [...fixed, ...ordered, ...noCoord];
    let dist = 0;
    for (let i = 1; i < dayOrdered.length; i++) {
      const a = stopCoords(dayOrdered[i - 1]);
      const b = stopCoords(dayOrdered[i]);
      if (a && b) dist += haversineKm(a, b);
    }
    report.push({
      day,
      distanceKm: Math.round(dist * 10) / 10,
      etaHours: Math.round((dist / speed) * 10) / 10,
      transport,
    });
    out.push(...dayOrdered);
  }
  return {
    stops: out.map(({ __i, ...rest }) => rest),
    report,
  };
}

export function moveStop(stops, stopId, { toDay, index } = {}) {
  const list = (stops || []).slice();
  const i = list.findIndex((s) => String(s.id) === String(stopId));
  if (i < 0) return list;
  const [item] = list.splice(i, 1);
  const next = { ...item };
  if (toDay != null) {
    next.day = toDay;
    if (next.date) next.date = toDay;
  }
  const at = Number.isFinite(index) ? index : list.length;
  list.splice(Math.max(0, Math.min(list.length, at)), 0, next);
  return list;
}

export function duplicateStop(stops, stopId) {
  const list = (stops || []).slice();
  const hit = list.find((s) => String(s.id) === String(stopId));
  if (!hit) return list;
  const copy = {
    ...hit,
    id: `stop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: `${hit.title || hit.name || "Tappa"} (copia)`,
    completed: false,
    done: false,
  };
  const i = list.indexOf(hit);
  list.splice(i + 1, 0, copy);
  return list;
}
