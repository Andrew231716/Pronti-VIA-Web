/** Group voting / polls stored under trip.meta.polls */

export function createPoll({
  title,
  description = "",
  cost = null,
  link = "",
  photo = "",
  options = [],
  createdBy = "",
} = {}) {
  const t = String(title || "").trim();
  if (!t) throw new Error("Titolo votazione obbligatorio.");
  const opts = (options.length ? options : [{ label: t }]).map((o, i) => ({
    id: o.id || `opt-${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
    label: String(o.label || `Opzione ${i + 1}`).trim().slice(0, 120),
    votes: Array.isArray(o.votes) ? o.votes.slice() : [],
  }));
  return {
    id: `poll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: t.slice(0, 120),
    description: String(description || "").slice(0, 2000),
    cost: cost == null || cost === "" ? null : Number(cost),
    link: String(link || "").slice(0, 500),
    photo: String(photo || "").slice(0, 500),
    options: opts,
    status: "open",
    createdBy: String(createdBy || "").slice(0, 80),
    createdAt: new Date().toISOString(),
    closedAt: null,
    winnerId: null,
  };
}

export function castVote(poll, optionId, voterId) {
  if (!poll || poll.status !== "open") throw new Error("Votazione chiusa.");
  const vid = String(voterId || "").trim();
  if (!vid) throw new Error("Votante mancante.");
  const next = {
    ...poll,
    options: poll.options.map((o) => ({
      ...o,
      votes: (o.votes || []).filter((v) => v !== vid),
    })),
  };
  const opt = next.options.find((o) => o.id === optionId);
  if (!opt) throw new Error("Opzione non trovata.");
  opt.votes.push(vid);
  return next;
}

export function closePoll(poll) {
  if (!poll) throw new Error("Votazione assente.");
  let winnerId = null;
  let best = -1;
  for (const o of poll.options || []) {
    const n = (o.votes || []).length;
    if (n > best) {
      best = n;
      winnerId = o.id;
    } else if (n === best) {
      winnerId = null; // tie
    }
  }
  return {
    ...poll,
    status: "closed",
    closedAt: new Date().toISOString(),
    winnerId,
  };
}

export function tally(poll) {
  return (poll?.options || []).map((o) => ({
    id: o.id,
    label: o.label,
    count: (o.votes || []).length,
  }));
}
