import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { createFleet, FleetSimulator } from '../src/simulator.js';

test('la flotte contient 7 véhicules par défaut avec des identifiants distincts', () => {
  const fleet = createFleet();

  assert.equal(fleet.length, 7);
  assert.equal(new Set(fleet.map(({ carId }) => carId)).size, 7);
});

test('la variable VEHICLE_COUNT dimensionne exactement la flotte', () => {
  const config = loadConfig({ VEHICLE_COUNT: '12' });
  const fleet = createFleet(config);

  assert.equal(config.vehicleCount, 12);
  assert.equal(fleet.length, 12);
});

test('chaque véhicule possède son propre itinéraire dans Paris 2e', () => {
  const fleet = createFleet({ vehicleCount: 10 });

  assert.equal(new Set(fleet.map(({ routeId }) => routeId)).size, 10);

  for (const vehicle of fleet) {
    assert.equal(vehicle.routeId, vehicle.route.routeId);
    assert.ok(vehicle.route.coordinates.length >= 2);

    for (const coordinate of vehicle.route.coordinates) {
      assert.ok(coordinate.lat > 48.86 && coordinate.lat < 48.88);
      assert.ok(coordinate.lng > 2.33 && coordinate.lng < 2.36);
    }
  }
});

test('les partitions Kafka sont configurables sans modifier le code', () => {
  assert.equal(loadConfig({ KAFKA_TOPIC_PARTITIONS: '6' }).kafkaTopicPartitions, 6);
  assert.equal(loadConfig({}).kafkaTopicPartitions, 1);
});

test('une configuration invalide est refusée explicitement', () => {
  assert.throws(() => loadConfig({ VEHICLE_COUNT: '0' }), /VEHICLE_COUNT/);
  assert.throws(() => loadConfig({ VEHICLE_COUNT: '2.5' }), /VEHICLE_COUNT/);
  assert.throws(() => loadConfig({ VEHICLE_COUNT: 'abc' }), /VEHICLE_COUNT/);
});

test('les positions respectent le schéma et restent sur leur itinéraire', () => {
  const [vehicle] = createFleet({ vehicleCount: 1 });
  const position = vehicle.nextPosition(123456789);

  assert.deepEqual(Object.keys(position), [
    'carId', 'lat', 'lng', 'heading', 'speed', 'routeId', 'ts',
  ]);
  assert.equal(position.carId, vehicle.carId);
  assert.equal(position.routeId, vehicle.routeId);
  assert.equal(position.ts, 123456789);
  assert.ok(position.heading >= 0 && position.heading < 360);
});

test('7 véhicules émettent 140 positions par seconde à la cadence nominale', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const positions = [];
  const simulator = new FleetSimulator(
    { vehicleCount: 7, positionIntervalMs: 50 },
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
    { vehicleCount: 3, positionIntervalMs: 5 },
    ({ carId }) => receivedByCar.set(carId, (receivedByCar.get(carId) ?? 0) + 1),
  );

  simulator.start();
  await new Promise((resolve) => setTimeout(resolve, 40));
  simulator.stop();

  assert.equal(receivedByCar.size, 3);
  for (const count of receivedByCar.values()) assert.ok(count > 0);
});
