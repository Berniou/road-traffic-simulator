import assert from 'node:assert/strict';
import test from 'node:test';
import { FleetStore } from '../src/fleet-store.js';

function position(carId, ts, lat = 48.87) {
  return { carId, lat, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

test('les positions persistées alimentent immédiatement l’état initial de la flotte', () => {
  const store = new FleetStore();
  store.replaceAll([position('car-002', 200), position('car-001', 100)]);

  assert.deepEqual(store.snapshot(), [position('car-001', 100), position('car-002', 200)]);
});

test('les notifications WebSocket actualisent les véhicules après l’initialisation', () => {
  const store = new FleetStore();
  store.replaceAll([position('car-001', 100)]);
  store.upsert(position('car-001', 200, 48.88));

  assert.deepEqual(store.snapshot(), [position('car-001', 200, 48.88)]);
});

test('une réponse initiale plus ancienne ne remplace pas une notification déjà reçue', () => {
  const store = new FleetStore();
  store.upsert(position('car-001', 200, 48.88));
  store.replaceAll([position('car-001', 100, 48.87), position('car-002', 150)]);

  assert.deepEqual(store.snapshot(), [
    position('car-001', 200, 48.88),
    position('car-002', 150),
  ]);
});
