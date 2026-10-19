const STORAGE_KEY = 'pronti-via-trips';

function readTrips() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeTrips(trips) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

function getTrips() {
  return readTrips();
}

function createTrip({ destination, date, travelers }) {
  const trips = readTrips();
  const newTrip = {
    id: crypto.randomUUID(),
    destination,
    date,
    travelers,
    createdAt: new Date().toISOString(),
  };

  const nextTrips = [...trips, newTrip];
  writeTrips(nextTrips);
  return newTrip;
}

function deleteTrip(id) {
  const trips = readTrips();
  const nextTrips = trips.filter((trip) => trip.id !== id);
  writeTrips(nextTrips);
  return nextTrips;
}

export { STORAGE_KEY, getTrips, createTrip, deleteTrip };

if (typeof globalThis !== 'undefined' && !globalThis.localStorage) {
  globalThis.localStorage = {
    store: {},
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    },
    setItem(key, value) {
      this.store[key] = String(value);
    },
    removeItem(key) {
      delete this.store[key];
    },
    clear() {
      this.store = {};
    },
  };
}
