import assert from 'node:assert/strict';
import test from 'node:test';
import { createKafkaWebSocketApi, createPositionMessageHandler } from '../src/kafka-websocket-api.js';

function position(carId, ts) {
  return { carId, lat: 48.87, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

function kafkaMessage(value) {
  return { message: { value: Buffer.from(JSON.stringify(value)) } };
}

test('chaque message Kafka est diffusé immédiatement et indépendamment', async () => {
  const received = [];
  const handler = createPositionMessageHandler({ broadcast: (value) => received.push(value) });

  await handler(kafkaMessage(position('car-001', 1)));
  await handler(kafkaMessage(position('car-002', 2)));

  assert.deepEqual(received, [position('car-001', 1), position('car-002', 2)]);
});

test('un message Kafka invalide est ignoré sans interrompre les suivants', async (t) => {
  t.mock.method(console, 'error', () => {});
  const received = [];
  const handler = createPositionMessageHandler({ broadcast: (value) => received.push(value) });

  await handler({ message: { value: Buffer.from('JSON invalide') } });
  await handler(kafkaMessage(position('car-001', 2)));

  assert.deepEqual(received, [position('car-001', 2)]);
});

test("l'API s'abonne au topic filtré et transmet ses messages au serveur Admin", async () => {
  const calls = [];
  const received = [];
  let eachMessage;
  const consumer = {
    connect: async () => calls.push('connect'),
    subscribe: async (options) => calls.push(['subscribe', options]),
    run: async (options) => {
      calls.push('run');
      eachMessage = options.eachMessage;
    },
    disconnect: async () => calls.push('disconnect'),
  };
  const adminServer = {
    broadcaster: { broadcast: (value) => received.push(value) },
    close: async () => calls.push('close'),
  };

  const api = await createKafkaWebSocketApi(
    { kafkaLatestTopic: 'car.positions.latest' },
    { consumer, adminServer },
  );
  await eachMessage(kafkaMessage(position('car-001', 1)));
  await api.close();

  assert.deepEqual(calls[0], 'connect');
  assert.deepEqual(calls[1], ['subscribe', {
    topic: 'car.positions.latest',
    fromBeginning: false,
  }]);
  assert.equal(calls[2], 'run');
  assert.deepEqual(received, [position('car-001', 1)]);
  assert.deepEqual(calls.slice(-2), ['disconnect', 'close']);
});
