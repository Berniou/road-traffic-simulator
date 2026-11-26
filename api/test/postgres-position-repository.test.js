import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresPositionRepository } from '../src/persistence/postgres-position-repository.js';

function position(carId, ts, lat = 48.87) {
  return { carId, lat, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

function fakePool() {
  const rows = new Map();
  const queries = [];

  return {
    queries,
    async query(text, values = []) {
      queries.push({ text, values });
      if (text.includes('CREATE TABLE')) return { rows: [] };
      if (text.includes('INSERT INTO car_positions')) {
        const [carId, lat, lng, heading, speed, routeId, ts] = values;
        const current = rows.get(carId);
        if (!current || current.ts <= ts) {
          rows.set(carId, {
            car_id: carId, lat, lng, heading, speed, route_id: routeId, ts: String(ts),
          });
        }
        return { rows: [] };
      }
      if (text.includes('SELECT * FROM car_positions')) {
        return { rows: [...rows.values()].sort((a, b) => a.car_id.localeCompare(b.car_id)) };
      }
      throw new Error(`Requête inattendue: ${text}`);
    },
    async end() {},
  };
}

test('le schéma ne conserve qu’une ligne par véhicule et restitue la dernière position', async () => {
  const pool = fakePool();
  const repository = createPostgresPositionRepository('postgresql://unused', { pool });

  await repository.initialize();
  await repository.save(position('car-001', 100, 48.87));
  await repository.save(position('car-001', 200, 48.88));
  await repository.save(position('car-002', 150));

  assert.deepEqual(await repository.findAll(), [
    position('car-001', 200, 48.88),
    position('car-002', 150),
  ]);
  assert.match(pool.queries[1].text, /ON CONFLICT \(car_id\) DO UPDATE/);
});

test('une position plus ancienne ne remplace pas la dernière position connue', async () => {
  const repository = createPostgresPositionRepository('postgresql://unused', { pool: fakePool() });

  await repository.save(position('car-001', 200, 48.88));
  await repository.save(position('car-001', 100, 48.87));

  assert.deepEqual(await repository.findAll(), [position('car-001', 200, 48.88)]);
});

test('les positions persistent entre deux instances du dépôt', async () => {
  const pool = fakePool();
  const firstRepository = createPostgresPositionRepository('postgresql://unused', { pool });
  await firstRepository.save(position('car-001', 200));

  const repositoryAfterRestart = createPostgresPositionRepository('postgresql://unused', { pool });
  assert.deepEqual(await repositoryAfterRestart.findAll(), [position('car-001', 200)]);
});
