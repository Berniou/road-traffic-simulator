import assert from 'node:assert/strict';
import test from 'node:test';
import { KafkaPositionPublisher } from '../src/kafka-publisher.js';

function position(carId, ts) {
  return { carId, lat: 48.87, lng: 2.34, heading: 90, speed: 10, routeId: 'route-001', ts };
}

test('chaque position est publiée dans le topic brut avec carId comme clé', async () => {
  const sent = [];
  const publisher = new KafkaPositionPublisher({
    topic: 'car.positions.raw',
    producer: { send: async (message) => sent.push(message) },
  });
  const expected = position('car-001', 123456789);

  await publisher.publish(expected);

  assert.equal(sent.length, 1);
  assert.equal(sent[0].topic, 'car.positions.raw');
  assert.equal(sent[0].messages[0].key, 'car-001');
  assert.equal(sent[0].messages[0].timestamp, '123456789');
  assert.deepEqual(JSON.parse(sent[0].messages[0].value), expected);
});

test('les envois sont ordonnés par véhicule sans bloquer les autres véhicules', async () => {
  const sent = [];
  let releaseFirst;
  const firstSend = new Promise((resolve) => { releaseFirst = resolve; });
  const publisher = new KafkaPositionPublisher({
    topic: 'car.positions.raw',
    producer: {
      send: async ({ messages }) => {
        const message = messages[0];
        sent.push(message.key);
        if (message.key === 'car-001' && sent.length === 1) await firstSend;
      },
    },
  });

  const first = publisher.publish(position('car-001', 1));
  const second = publisher.publish(position('car-001', 2));
  const independent = publisher.publish(position('car-002', 3));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(sent, ['car-001', 'car-002']);
  releaseFirst();
  await Promise.all([first, second, independent]);
  assert.deepEqual(sent, ['car-001', 'car-002', 'car-001']);
});

test('une erreur de publication ne bloque pas la position suivante du véhicule', async () => {
  const timestamps = [];
  const publisher = new KafkaPositionPublisher({
    topic: 'car.positions.raw',
    producer: {
      send: async ({ messages }) => {
        const value = JSON.parse(messages[0].value);
        timestamps.push(value.ts);
        if (value.ts === 1) throw new Error('Kafka indisponible');
      },
    },
  });

  await assert.rejects(publisher.publish(position('car-001', 1)));
  await publisher.publish(position('car-001', 2));
  assert.deepEqual(timestamps, [1, 2]);
});
