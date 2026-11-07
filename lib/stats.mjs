/** Trip and portfolio statistics using integer cents. */

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(+a) || Number.isNaN(+b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

// Native trip amounts are integer cents, including amounts below one euro.
export function expenseAmountCents(expense) {
  if (Number.isFinite(expense.amountCents)) return Math.trunc(expense.amountCents);
  return Number.isFinite(expense.amount) ? Math.round(expense.amount) : 0;
}

export function expenseTotalCents(expenses) {
  return (expenses || []).reduce((sum, expense) => sum + expenseAmountCents(expense), 0);
}

export function tripStats(trip) {
  const members = trip?.members || [];
  const expenses = trip?.expenses || [];
  const stops = trip?.stops || [];
  const checklist = trip?.checklist || [];
  const spent = expenseTotalCents(expenses);
  const days = daysBetween(trip?.start, trip?.end) || 1;
  const people = Math.max(1, members.length || trip?.travelers || 1);
  const byCat = Object.create(null);
  for (const e of expenses) {
    const cat = e.category || e.type || "altro";
    byCat[cat] = (byCat[cat] || 0) + expenseAmountCents(e);
  }
  const doneStops = stops.filter((s) => s.done || s.completed || s.status === "done").length;
  const doneCheck = checklist.filter((c) => c.done || c.checked).length;
  const budgetCents = Number.isFinite(trip?.budgetCents)
    ? Math.trunc(trip.budgetCents)
    : Math.round((Number(trip?.budget) || 0) * (Math.abs(Number(trip?.budget) || 0) >= 100 && Number.isInteger(Number(trip?.budget)) ? 1 : 100));

  return {
    title: trip?.title || "",
    destination: trip?.destination || "",
    days,
    people,
    spentCents: spent,
    budgetCents,
    remainingCents: budgetCents - spent,
    perPersonCents: Math.round(spent / people),
    perDayCents: Math.round(spent / days),
    byCategory: byCat,
    stopsTotal: stops.length,
    stopsDone: doneStops,
    checklistTotal: checklist.length,
    checklistDone: doneCheck,
  };
}

export function portfolioStats(trips) {
  const list = (trips || []).map((t) => t?.trip || t);
  let spent = 0;
  let days = 0;
  const countries = new Set();
  const cities = new Set();
  const destCount = {};
  for (const t of list) {
    const s = tripStats(t);
    spent += s.spentCents;
    days += s.days;
    const dest = (t.destination || "").trim();
    if (dest) {
      destCount[dest] = (destCount[dest] || 0) + 1;
      cities.add(dest.split(",")[0].trim());
      const parts = dest.split(",");
      if (parts.length > 1) countries.add(parts[parts.length - 1].trim());
      else countries.add(dest);
    }
  }
  const frequent = Object.entries(destCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  return {
    tripCount: list.length,
    spentCents: spent,
    avgSpentCents: list.length ? Math.round(spent / list.length) : 0,
    totalDays: days,
    countries: [...countries],
    cities: [...cities],
    frequentDestinations: frequent,
  };
}

export function statsToCsv(tripStatList) {
  const rows = [["title", "destination", "days", "people", "spent_eur", "budget_eur", "per_person_eur"]];
  for (const s of tripStatList || []) {
    rows.push([
      s.title,
      s.destination,
      s.days,
      s.people,
      (s.spentCents / 100).toFixed(2),
      (s.budgetCents / 100).toFixed(2),
      (s.perPersonCents / 100).toFixed(2),
    ]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
