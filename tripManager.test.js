import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, deleteTrip, getTrips } from './tripManager.js';

if (!globalThis.localStorage) {
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
  };
}

test('createTrip adds a new travel item', () => {
  localStorage.clear?.();
  const initialTrips = getTrips();
  const trip = createTrip({
    destination: 'Roma',
    date: '2026-10-10',
    travelers: 2,
  });

  assert.equal(Array.isArray(getTrips()), true);
  assert.equal(getTrips().length, initialTrips.length + 1);
  assert.equal(trip.destination, 'Roma');
});

test('deleteTrip removes the selected travel item', () => {
  localStorage.clear?.();
  const trip = createTrip({
    destination: 'Milano',
    date: '2026-11-11',
    travelers: 3,
  });

  const remainingTrips = deleteTrip(trip.id);
  assert.equal(remainingTrips.some((item) => item.id === trip.id), false);
});
