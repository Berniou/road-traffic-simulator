import assert from 'node:assert/strict';
import test from 'node:test';
import { createKafkaApi, createPositionMessageHandler } from '../src/kafka-api.js';

function position(carId, ts) {
  return { carId, lat: 48.87, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

function kafkaMessage(value) {
  return { message: { value: Buffer.from(JSON.stringify(value)) } };
}

test('chaque message Kafka est notifié immédiatement et indépendamment', async () => {
  const received = [];
  const notifier = { notify: async (value) => received.push(value) };
  const handler = createPositionMessageHandler(notifier);

  await handler(kafkaMessage(position('car-001', 1)));
  await handler(kafkaMessage(position('car-002', 2)));

  assert.deepEqual(received, [position('car-001', 1), position('car-002', 2)]);
});

test('chaque position consommée est persistée avant sa notification', async () => {
  const calls = [];
  const notifier = { notify: async () => calls.push('notification') };
  const handler = createPositionMessageHandler(
    notifier,
    { save: async () => calls.push('persistance') },
  );

  await handler(kafkaMessage(position('car-001', 1)));

  assert.deepEqual(calls, ['persistance', 'notification']);
});

test('un message Kafka invalide est ignoré sans interrompre les suivants', async (t) => {
  t.mock.method(console, 'error', () => {});
  const received = [];
  const notifier = { notify: async (value) => received.push(value) };
  const handler = createPositionMessageHandler(notifier);

  await handler({ message: { value: Buffer.from('JSON invalide') } });
  await handler(kafkaMessage(position('car-001', 2)));

  assert.deepEqual(received, [position('car-001', 2)]);
});

test("l'API initialise et ferme le stockage des positions avec son cycle de vie", async () => {
  const calls = [];
  const consumer = {
    connect: async () => {},
    subscribe: async () => {},
    run: async () => {},
    disconnect: async () => {},
  };
  const notifier = { notify: async () => {} };
  const positionRepository = {
    initialize: async () => calls.push('initialize'),
    save: async () => {},
    close: async () => calls.push('close repository'),
  };

  const api = await createKafkaApi(
    { kafkaLatestTopic: 'car.positions.latest', notifierUrl: 'http://notifier:8080' },
    { consumer, notifier, positionRepository },
  );
  await api.close();

  assert.equal(api.positionRepository, positionRepository);
  assert.deepEqual(calls, ['initialize', 'close repository']);
});

test("l'API s'abonne au topic filtré et notifie le notificateur", async () => {
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
  const notifier = {
    notify: async (value) => received.push(value),
  };

  const api = await createKafkaApi(
    { kafkaLatestTopic: 'car.positions.latest', notifierUrl: 'http://notifier:8080' },
    { consumer, notifier },
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
  assert.deepEqual(calls.slice(-1), ['disconnect']);
});
