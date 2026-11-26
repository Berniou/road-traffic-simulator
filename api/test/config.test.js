import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';

test("l'API consomme car.positions.latest et expose le WebSocket Admin par défaut", () => {
  const config = loadConfig({});
  assert.equal(config.kafkaLatestTopic, 'car.positions.latest');
  assert.equal(config.kafkaGroupId, 'admin-position-api');
  assert.equal(config.webSocketPort, 8080);
  assert.equal(config.webSocketPath, '/ws');
});

test('la configuration Kafka et WebSocket est personnalisable', () => {
  const config = loadConfig({
    KAFKA_BROKERS: 'kafka-1:9092, kafka-2:9092',
    KAFKA_LATEST_TOPIC: 'positions.latest',
    WEBSOCKET_PORT: '9090',
    WEBSOCKET_PATH: '/admin',
  });
  assert.deepEqual(config.kafkaBrokers, ['kafka-1:9092', 'kafka-2:9092']);
  assert.equal(config.kafkaLatestTopic, 'positions.latest');
  assert.equal(config.webSocketPort, 9090);
  assert.equal(config.webSocketPath, '/admin');
  assert.throws(() => loadConfig({ WEBSOCKET_PORT: '70000' }), /WEBSOCKET_PORT/);
});
