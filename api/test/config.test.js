import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';

test("l'API consomme car.positions.latest et notifie le notificateur par défaut", () => {
  const config = loadConfig({});
  assert.equal(config.kafkaLatestTopic, 'car.positions.latest');
  assert.equal(config.kafkaGroupId, 'admin-position-api');
  assert.equal(config.notifierUrl, 'http://localhost:8080');
  assert.equal(config.databaseUrl, 'postgresql://postgres:postgres@localhost:5432/fleet');
});

test('la configuration Kafka et notificateur est personnalisable', () => {
  const config = loadConfig({
    KAFKA_BROKERS: 'kafka-1:9092, kafka-2:9092',
    KAFKA_LATEST_TOPIC: 'positions.latest',
    NOTIFIER_URL: 'http://notifier:8081',
    DATABASE_URL: 'postgresql://db:5432/custom-fleet',
  });
  assert.deepEqual(config.kafkaBrokers, ['kafka-1:9092', 'kafka-2:9092']);
  assert.equal(config.kafkaLatestTopic, 'positions.latest');
  assert.equal(config.notifierUrl, 'http://notifier:8081');
  assert.equal(config.databaseUrl, 'postgresql://db:5432/custom-fleet');
});
