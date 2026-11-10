/**
 * SPA-compatible trip fixture (Zod schema in index-loadfix).
 * Expenses MUST include shares[]; transfers/stops/bookings/checklist arrays required.
 */
export function validTrip(overrides = {}) {
  const members = overrides.members || [
    { id: "m1", name: "Andrea" },
    { id: "m2", name: "Luca" },
  ];
  const base = {
    title: "E2E Roma",
    destination: "Roma, Italia",
    start: "2027-06-01",
    end: "2027-06-05",
    budget: 120000,
    members,
    stops: [
      {
        id: "s1",
        day: "2027-06-01",
        title: "Colosseo",
        time: "10:00",
        notes: "Biglietto online",
        category: "Visita",
        address: "Piazza del Colosseo",
        lat: 41.8902,
        lng: 12.4922,
      },
    ],
    bookings: [
      {
        id: "b1",
        title: "Hotel Centro",
        type: "Hotel",
        date: "2027-06-01",
        reference: "HTL-1",
        notes: "",
        url: "https://example.com/hotel",
      },
    ],
    expenses: [
      {
        id: "e1",
        title: "Caffè",
        amount: 1200,
        payer: "m1",
        date: "2027-06-01",
        category: "Cibo",
        shares: [
          { member: "m1", amount: 600 },
          { member: "m2", amount: 600 },
        ],
      },
    ],
    transfers: [],
    checklist: [{ id: "c1", title: "Passaporto", done: false }],
    notes: "Fixture verifica UX 20261104g",
    meta: {
      roles: { m1: "owner", m2: "member" },
      polls: [],
      prep: [],
      reminders: [],
    },
  };
  return { ...base, ...overrides, members: overrides.members || base.members, meta: { ...base.meta, ...(overrides.meta || {}) } };
}

export function tripApiPayload(tripOverrides = {}) {
  return {
    id: "e2e-trip-1",
    key: "e2e-key-1",
    viewToken: "e2e-view-1",
    trip: validTrip(tripOverrides),
    revision: 2,
    canEdit: true,
    local: false,
    source: "store",
    durable: true,
  };
}
