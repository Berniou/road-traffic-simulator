import assert from 'node:assert/strict';
import test from 'node:test';
import { LatestPositionFilter } from '../src/latest-position-filter.js';

function position(carId, ts) {
  return { carId, lat: 48.87, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

function createHarness() {
  const published = [];
  let currentTime = 0;
  const filter = new LatestPositionFilter({
    now: () => currentTime,
    schedule: () => null,
    cancel: () => {},
    onWindowClosed: (value, window) => published.push({ value, window }),
  });
  return {
    filter,
    published,
    setTime: (value) => { currentTime = value; },
  };
}

test('une fenêtre fixe publie uniquement la position au ts le plus récent', async () => {
  const { filter, published } = createHarness();
  filter.ingest(position('car-001', 100));
  filter.ingest(position('car-001', 250));
  filter.ingest(position('car-001', 150));

  filter.closeWindow('car-001', 0);
  await filter.flush();

  assert.equal(published.length, 1);
  assert.equal(published[0].value.ts, 250);
  assert.deepEqual(published[0].window, { start: 0, end: 300 });
});

test('chaque fenêtre non glissante produit au maximum une position', async () => {
  const { filter, published } = createHarness();
  filter.ingest(position('car-001', 100));
  filter.ingest(position('car-001', 350));
  filter.ingest(position('car-001', 550));

  filter.closeWindow('car-001', 0);
  filter.closeWindow('car-001', 300);
  await filter.flush();

  assert.deepEqual(published.map(({ value }) => value.ts), [100, 550]);
  assert.equal(filter.ingest(position('car-001', 200)), false);
  await filter.flush();
  assert.equal(published.length, 2);
});

test('aucune position n’est produite pour une fenêtre vide', async () => {
  const { filter, published } = createHarness();
  filter.ingest(position('car-001', 100));
  filter.closeWindow('car-001', 0);
  filter.closeWindow('car-001', 300);
  await filter.flush();

  assert.equal(published.length, 1);
});

test('les fenêtres des véhicules sont indépendantes', async () => {
  const { filter, published } = createHarness();
  filter.ingest(position('car-001', 100));
  filter.ingest(position('car-002', 150));
  filter.ingest(position('car-001', 400));

  filter.closeWindow('car-001', 300);
  await filter.flush();
  assert.deepEqual(published.map(({ value }) => [value.carId, value.ts]), [['car-001', 400]]);

  filter.closeWindow('car-001', 0);
  filter.closeWindow('car-002', 0);
  await filter.flush();
  assert.deepEqual(published.map(({ value }) => [value.carId, value.ts]), [
    ['car-001', 400],
    ['car-001', 100],
    ['car-002', 150],
  ]);
});

test('7 véhicules produisent environ 23 messages/s en régime nominal', async () => {
  const { filter, published } = createHarness();
  for (let car = 1; car <= 7; car += 1) {
    const carId = `car-${String(car).padStart(3, '0')}`;
    for (let ts = 0; ts < 900; ts += 50) filter.ingest(position(carId, ts));
  }

  for (let car = 1; car <= 7; car += 1) {
    const carId = `car-${String(car).padStart(3, '0')}`;
    for (const start of [0, 300, 600]) filter.closeWindow(carId, start);
  }
  await filter.flush();

  assert.equal(published.length, 21);
  assert.ok(Math.abs((published.length / 0.9) - 23.3) < 0.1);
});

test('la fermeture est planifiée à la fin de la fenêtre', () => {
  let delay;
  const filter = new LatestPositionFilter({
    now: () => 110,
    schedule: (callback, value) => { delay = value; return callback; },
    onWindowClosed: () => {},
  });

  filter.ingest(position('car-001', 100));
  assert.equal(delay, 190);
});

test('les positions invalides sont refusées', () => {
  const { filter } = createHarness();
  assert.throws(() => filter.ingest({ ts: 100 }), /carId/);
  assert.throws(() => filter.ingest(position('car-001', NaN)), /ts/);
});
