/**
 * Monetary helpers — amounts in minor units (cents) unless noted.
 * Avoid floating-point drift; remainder goes to the first participants.
 */

export function toCents(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents) {
  return (Number(cents) || 0) / 100;
}

export function roundMoney(amount, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round((Number(amount) || 0) * f) / f;
}

/** Equal split of cents across n people; first get +1 remainder. */
export function splitEqualCents(totalCents, n) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const total = Math.trunc(Number(totalCents) || 0);
  if (count <= 0) return [];
  const base = Math.trunc(total / count);
  const rem = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Custom shares: weights must be positive; returns cents summing to total. */
export function splitWeightedCents(totalCents, weights) {
  const total = Math.trunc(Number(totalCents) || 0);
  const w = (weights || []).map((x) => Math.max(0, Number(x) || 0));
  const sumW = w.reduce((a, b) => a + b, 0);
  if (!w.length || sumW <= 0) return w.map(() => 0);
  const raw = w.map((x) => (total * x) / sumW);
  const floors = raw.map((x) => Math.floor(x));
  let left = total - floors.reduce((a, b) => a + b, 0);
  const frac = raw.map((x, i) => ({ i, f: x - floors[i] })).sort((a, b) => b.f - a.f);
  for (const { i } of frac) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/**
 * Build balances: positive = is owed, negative = owes.
 * expenses: { amountCents, paidBy, participantIds[] } with equal split among participants.
 */
export function computeBalances(expenses, memberIds) {
  const bal = Object.fromEntries((memberIds || []).map((id) => [id, 0]));
  for (const e of expenses || []) {
    const parts = (e.participantIds || []).filter((id) => id in bal);
    if (!parts.length || !(e.paidBy in bal)) continue;
    const cents = Math.trunc(Number(e.amountCents) || 0);
    const shares = splitEqualCents(cents, parts.length);
    bal[e.paidBy] += cents;
    parts.forEach((id, i) => {
      bal[id] -= shares[i];
    });
  }
  return bal;
}

/** Greedy settlements from balances (cents). */
export function settleBalances(balances) {
  const debtors = [];
  const creditors = [];
  for (const [id, v] of Object.entries(balances || {})) {
    const n = Math.trunc(v);
    if (n < -0) debtors.push({ id, amount: -n });
    else if (n > 0) creditors.push({ id, amount: n });
  }
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);
  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      transfers.push({ from: debtors[i].id, to: creditors[j].id, amountCents: pay });
      debtors[i].amount -= pay;
      creditors[j].amount -= pay;
    }
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }
  return transfers;
}

export function convertWithRate(amount, rate) {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return null;
  return roundMoney((Number(amount) || 0) * r);
}
