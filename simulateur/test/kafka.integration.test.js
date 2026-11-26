import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Kafka, logLevel } from 'kafkajs';
import { loadConfig } from '../src/config.js';
import { createKafkaPositionPublisher } from '../src/kafka-publisher.js';
import { FleetSimulator } from '../src/simulator.js';

test('Kafka conserve la clé, le schéma et l’ordre à 140 messages/s', {
  skip: process.env.KAFKA_INTEGRATION_TEST !== 'true',
  timeout: 30000,
}, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const config = {
    ...loadConfig(),
    kafkaRawTopic: `car.positions.raw.test.${suffix}`,
  };
  const kafka = new Kafka({
    clientId: `integration-test-${suffix}`,
    brokers: config.kafkaBrokers,
    logLevel: logLevel.ERROR,
  });
  const consumer = kafka.consumer({ groupId: `integration-test-${suffix}` });
  const { publisher, disconnect } = await createKafkaPositionPublisher(config);
  const received = [];
  const simulator = new FleetSimulator(config, (position) => {
    publisher.publish(position).catch(() => {});
  });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: config.kafkaRawTopic, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        received.push({ key: message.key.toString(), ...JSON.parse(message.value.toString()) });
      },
    });

    simulator.start();
    await delay(1050);
    simulator.stop();
    await publisher.flush();

    const deadline = Date.now() + 10000;
    while (received.length < 126 && Date.now() < deadline) await delay(50);

    assert.ok(received.length >= 126 && received.length <= 154,
      `Débit mesuré hors tolérance : ${received.length} messages/s`);

    const timestampsByCar = new Map();
    for (const position of received) {
      assert.equal(position.key, position.carId);
      assert.deepEqual(Object.keys(position).sort(), [
        'carId', 'heading', 'key', 'lat', 'lng', 'routeId', 'speed', 'ts',
      ]);
      assert.ok(Number.isInteger(position.ts));

      const previous = timestampsByCar.get(position.carId) ?? -Infinity;
      assert.ok(position.ts >= previous, `Ordre invalide pour ${position.carId}`);
      timestampsByCar.set(position.carId, position.ts);
    }
    assert.equal(timestampsByCar.size, 7);
  } finally {
    simulator.stop();
    await Promise.allSettled([publisher.flush(), consumer.disconnect()]);
    await disconnect();
  }
});
