import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { loadRoute } from '../src/routes.js';
import { createFleet, FleetSimulator } from '../src/simulator.js';

function testRoutes(count) {
  return Array.from({ length: count }, (_, index) => {
    const lat = 48.868 + index * 0.0001;
    const lng = 2.339;
    const coordinates = [
      { lat, lng },
      { lat: lat + 0.001, lng },
      { lat: lat + 0.001, lng: lng + 0.001 },
      { lat, lng },
    ];

    return {
      routeId: `route-${String(index + 1).padStart(3, '0')}`,
      coordinates,
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map((point) => [point.lng, point.lat]),
      },
    };
  });
}

function createTestFleet(options = {}) {
  const vehicleCount = options.vehicleCount ?? 7;
  return createFleet({ routes: testRoutes(vehicleCount), ...options });
}

function simulatorConfig(vehicleCount, positionIntervalMs) {
  return { vehicleCount, positionIntervalMs, routes: testRoutes(vehicleCount) };
}

function isOnRoute(position, coordinates) {
  return coordinates.some((from, index) => {
    const to = coordinates[(index + 1) % coordinates.length];
    const latDelta = to.lat - from.lat;
    const lngDelta = to.lng - from.lng;
    if (latDelta === 0 && lngDelta === 0) return false;

    const ratio = Math.abs(latDelta) >= Math.abs(lngDelta) && latDelta !== 0
      ? (position.lat - from.lat) / latDelta
      : (position.lng - from.lng) / lngDelta;
    const tolerance = 1e-9;

    return ratio >= -tolerance && ratio <= 1 + tolerance
      && Math.abs(position.lat - (from.lat + latDelta * ratio)) < tolerance
      && Math.abs(position.lng - (from.lng + lngDelta * ratio)) < tolerance;
  });
}

test('la flotte contient 7 véhicules par défaut avec des identifiants distincts', () => {
  const fleet = createTestFleet();

  assert.equal(fleet.length, 7);
  assert.equal(new Set(fleet.map(({ carId }) => carId)).size, 7);
});

test('la variable VEHICLE_COUNT dimensionne exactement la flotte', () => {
  const config = loadConfig({ VEHICLE_COUNT: '12' });
  const fleet = createTestFleet(config);

  assert.equal(config.vehicleCount, 12);
  assert.equal(fleet.length, 12);
});

test('chaque véhicule possède son propre itinéraire OSRM dans Paris 2e', () => {
  const fleet = createTestFleet({ vehicleCount: 10 });

  assert.equal(new Set(fleet.map(({ routeId }) => routeId)).size, 10);

  for (const vehicle of fleet) {
    assert.equal(vehicle.routeId, vehicle.route.routeId);
    assert.equal(vehicle.route.geometry.type, 'LineString');
    assert.ok(vehicle.route.coordinates.length >= 2);

    for (const coordinate of vehicle.route.coordinates) {
      assert.ok(coordinate.lat > 48.86 && coordinate.lat < 48.88);
      assert.ok(coordinate.lng > 2.33 && coordinate.lng < 2.36);
    }
  }
});

test('OSRM calcule un itinéraire complet et sa géométrie GeoJSON devient la trajectoire', async () => {
  let requestedUrl;
  const geometry = {
    type: 'LineString',
    coordinates: [[2.339, 48.868], [2.34, 48.869], [2.34, 48.869]],
  };
  const route = await loadRoute(0, {
    osrmBaseUrl: 'http://osrm.interne/',
    fetchImpl: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({ code: 'Ok', routes: [{ geometry }] }),
      };
    },
  });

  assert.match(requestedUrl.pathname, /^\/route\/v1\/driving\//);
  assert.equal(requestedUrl.searchParams.get('overview'), 'full');
  assert.equal(requestedUrl.searchParams.get('geometries'), 'geojson');
  assert.equal(route.routeId, 'route-001');
  assert.deepEqual(route.geometry, {
    type: 'LineString',
    coordinates: [[2.339, 48.868], [2.34, 48.869]],
  });
  assert.deepEqual(route.coordinates, [
    { lat: 48.868, lng: 2.339 },
    { lat: 48.869, lng: 2.34 },
  ]);
});

test('une erreur OSRM empêche de créer une trajectoire hors route', async () => {
  await assert.rejects(() => loadRoute(0, {
    fetchImpl: async () => ({ ok: false, status: 503 }),
  }), /HTTP 503/);
});

test('les partitions Kafka sont configurables sans modifier le code', () => {
  assert.equal(loadConfig({ KAFKA_TOPIC_PARTITIONS: '6' }).kafkaTopicPartitions, 6);
  assert.equal(loadConfig({}).kafkaTopicPartitions, 1);
});

test('l’instance OSRM est configurable pour les environnements dédiés', () => {
  assert.equal(loadConfig({}).osrmBaseUrl, 'https://router.project-osrm.org');
  assert.equal(loadConfig({ OSRM_BASE_URL: 'http://osrm:5000' }).osrmBaseUrl, 'http://osrm:5000');
});

test('une configuration invalide est refusée explicitement', () => {
  assert.throws(() => loadConfig({ VEHICLE_COUNT: '0' }), /VEHICLE_COUNT/);
  assert.throws(() => loadConfig({ VEHICLE_COUNT: '2.5' }), /VEHICLE_COUNT/);
  assert.throws(() => loadConfig({ VEHICLE_COUNT: 'abc' }), /VEHICLE_COUNT/);
});

test('les positions respectent le schéma et utilisent leur itinéraire', () => {
  const [vehicle] = createTestFleet({ vehicleCount: 1 });
  const position = vehicle.nextPosition(123456789);

  assert.deepEqual(Object.keys(position), [
    'carId', 'lat', 'lng', 'heading', 'speed', 'routeId', 'ts',
  ]);
  assert.equal(position.carId, vehicle.carId);
  assert.equal(position.routeId, vehicle.routeId);
  assert.equal(position.ts, 123456789);
  assert.ok(position.heading >= 0 && position.heading < 360);
  assert.ok(position.lat >= vehicle.route.coordinates[0].lat);
  assert.ok(position.lat <= vehicle.route.coordinates[1].lat);
  assert.equal(position.lng, vehicle.route.coordinates[0].lng);
});

test('le véhicule reboucle sur le même itinéraire sans additionner deux fois la distance', () => {
  const [vehicle] = createTestFleet({ vehicleCount: 1 });
  vehicle.speed = 1_000_000;

  for (let index = 0; index < 20; index += 1) {
    const position = vehicle.nextPosition(index);
    assert.ok(Number.isFinite(position.lat));
    assert.ok(Number.isFinite(position.lng));
    assert.ok(isOnRoute(position, vehicle.route.coordinates));
    assert.equal(position.routeId, 'route-001');
  }

  assert.equal(vehicle.route.routeId, 'route-001');
});

test('7 véhicules émettent 140 positions par seconde à la cadence nominale', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const positions = [];
  const simulator = new FleetSimulator(
    simulatorConfig(7, 50),
    (position) => positions.push(position),
  );

  simulator.start();
  t.mock.timers.tick(1000);
  simulator.stop();

  assert.equal(positions.length, 140);
  const counts = positions.reduce((result, { carId }) => {
    result.set(carId, (result.get(carId) ?? 0) + 1);
    return result;
  }, new Map());
  assert.equal(counts.size, 7);
  for (const count of counts.values()) assert.equal(count, 20);
});

test('chaque véhicule émet indépendamment et le simulateur peut être arrêté', async () => {
  const receivedByCar = new Map();
  const simulator = new FleetSimulator(
    simulatorConfig(3, 5),
    ({ carId }) => receivedByCar.set(carId, (receivedByCar.get(carId) ?? 0) + 1),
  );

  simulator.start();
  await new Promise((resolve) => setTimeout(resolve, 40));
  simulator.stop();

  assert.equal(receivedByCar.size, 3);
  for (const count of receivedByCar.values()) assert.ok(count > 0);
});
