#!/usr/bin/env node
/**
 * Unit tests for lib/* — run: node scripts/unit/run-all.mjs
 */
import assert from "node:assert/strict";
import {
  splitEqualCents,
  splitWeightedCents,
  computeBalances,
  settleBalances,
  convertWithRate,
  toCents,
} from "../../lib/money.mjs";
import {
  classifyPersistence,
  SaveStatus,
  enqueueOutbox,
  detectConflict,
  statusLabel,
} from "../../lib/sync-state.mjs";
import { createPoll, castVote, closePoll, tally } from "../../lib/polls.mjs";
import { createBackup, validateBackup, planRestore, applyRestorePlan } from "../../lib/backup.mjs";
import { tripStats, portfolioStats, statsToCsv } from "../../lib/stats.mjs";
import { buildIcs, buildTripEvents, toIcsDate } from "../../lib/ics.mjs";
import { optimizeStops, haversineKm, moveStop, duplicateStop } from "../../lib/itinerary.mjs";
import { can, ROLES, roleMapFromTrip } from "../../lib/roles.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
  }
}

test("splitEqualCents remainder to first", () => {
  assert.deepEqual(splitEqualCents(100, 3), [34, 33, 33]);
  assert.equal(splitEqualCents(100, 3).reduce((a, b) => a + b, 0), 100);
});

test("splitWeightedCents sums to total", () => {
  const parts = splitWeightedCents(100, [1, 1, 2]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100);
  assert.equal(parts[2], 50);
});

test("computeBalances + settle", () => {
  const bal = computeBalances(
    [
      { amountCents: 9000, paidBy: "a", participantIds: ["a", "b", "c"] },
      { amountCents: 3000, paidBy: "b", participantIds: ["a", "b", "c"] },
    ],
    ["a", "b", "c"]
  );
  assert.equal(Object.values(bal).reduce((a, b) => a + b, 0), 0);
  const transfers = settleBalances(bal);
  assert.ok(transfers.length >= 1);
});

test("convertWithRate", () => {
  assert.equal(convertWithRate(10, 2), 20);
  assert.equal(convertWithRate(10, 0), null);
  assert.equal(toCents(12.345), 1235);
});

test("classifyPersistence honesty", () => {
  assert.equal(classifyPersistence({ local: true }), SaveStatus.LOCAL);
  assert.equal(classifyPersistence({ source: "memory" }), SaveStatus.LOCAL);
  assert.equal(classifyPersistence({ local: false, source: "blobs" }), SaveStatus.SERVER);
  assert.equal(classifyPersistence({ ok: false }), SaveStatus.ERROR);
  assert.match(statusLabel(SaveStatus.LOCAL), /locale|dispositivo/i);
});

test("outbox + conflict", () => {
  const q = enqueueOutbox([], { type: "trip-put", tripId: "t1" });
  assert.equal(q.length, 1);
  assert.equal(detectConflict(1, 2), true);
  assert.equal(detectConflict(3, 3), false);
});

test("polls create vote close", () => {
  let p = createPoll({ title: "Cena", options: [{ label: "Sushi" }, { label: "Pizza" }] });
  p = castVote(p, p.options[0].id, "alice");
  p = castVote(p, p.options[1].id, "bob");
  p = castVote(p, p.options[0].id, "bob"); // change vote
  assert.equal(tally(p).find((x) => x.label === "Sushi").count, 2);
  p = closePoll(p);
  assert.equal(p.status, "closed");
  assert.equal(p.winnerId, p.options[0].id);
});

test("backup validate + restore plan", () => {
  const bak = createBackup({
    trips: [{ id: "1", revision: 2, trip: { title: "Roma" } }],
  });
  const v = validateBackup(JSON.stringify(bak));
  assert.equal(v.ok, true);
  const plan = planRestore([{ id: "1", revision: 1, trip: { title: "Old" } }], bak.trips);
  assert.equal(plan.replaces, 1);
  const next = applyRestorePlan([{ id: "1", revision: 1, trip: { title: "Old" } }], plan);
  assert.equal(next[0].revision, 2);
});

test("stats trip + portfolio + csv", () => {
  const s = tripStats({
    title: "Islanda",
    destination: "Reykjavik, Islanda",
    start: "2026-06-01",
    end: "2026-06-05",
    members: [{ id: "a" }, { id: "b" }],
    expenses: [{ amount: 100, category: "cibo" }, { amount: 50, category: "trasporti" }],
    stops: [{ id: 1 }, { id: 2, done: true }],
    checklist: [{ done: true }, { done: false }],
  });
  assert.equal(s.days, 5);
  assert.ok(s.spentCents > 0);
  const port2 = portfolioStats([
    { destination: "Reykjavik, Islanda", start: "2026-06-01", end: "2026-06-05", expenses: [{ amount: 10 }] },
    { destination: "Roma, Italia", start: "2026-01-01", end: "2026-01-03", expenses: [] },
  ]);
  assert.equal(port2.tripCount, 2);
  assert.ok(statsToCsv([s]).includes("Islanda"));
});

test("ics builder", () => {
  assert.equal(toIcsDate("2026-11-04"), "20261104");
  const ics = buildIcs(
    buildTripEvents({
      id: "t1",
      title: "Test",
      start: "2026-11-10",
      end: "2026-11-12",
      bookings: [{ id: "b1", title: "Hotel", date: "2026-11-10" }],
    })
  );
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /Partenza/);
});

test("itinerary optimize + move + duplicate", () => {
  assert.ok(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) > 100);
  const stops = [
    { id: "a", day: "1", lat: 41.9, lng: 12.5, title: "A" },
    { id: "b", day: "1", lat: 41.91, lng: 12.52, title: "B" },
    { id: "c", day: "1", lat: 41.905, lng: 12.49, title: "C" },
  ];
  const { stops: opt, report } = optimizeStops(stops);
  assert.equal(opt.length, 3);
  assert.equal(report[0].day, "1");
  const moved = moveStop(stops, "b", { toDay: "2", index: 0 });
  assert.equal(moved.find((s) => s.id === "b").day, "2");
  const dup = duplicateStop(stops, "a");
  assert.equal(dup.length, 4);
});

test("roles permissions", () => {
  assert.equal(can(ROLES.OWNER, "delete"), true);
  assert.equal(can(ROLES.READONLY, "edit"), false);
  assert.equal(can(ROLES.MEMBER, "polls-vote"), true);
  const map = roleMapFromTrip({ members: [{ id: "m1" }, { id: "m2" }] });
  assert.equal(map.m1, ROLES.OWNER);
  assert.equal(map.m2, ROLES.MEMBER);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
