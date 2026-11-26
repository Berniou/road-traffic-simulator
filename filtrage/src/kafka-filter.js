import { Kafka, logLevel } from 'kafkajs';
import { LatestPositionFilter } from './latest-position-filter.js';

export async function createKafkaFilter(config) {
  const kafka = new Kafka({
    clientId: config.kafkaClientId,
    brokers: config.kafkaBrokers,
    logLevel: logLevel.ERROR,
  });
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [{
        topic: config.kafkaLatestTopic,
        numPartitions: config.kafkaTopicPartitions,
        replicationFactor: config.kafkaReplicationFactor,
      }],
    });
  } finally {
    await admin.disconnect();
  }

  const producer = kafka.producer({ idempotent: true, maxInFlightRequests: 1 });
  const consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  const queuesByCar = new Map();
  await Promise.all([producer.connect(), consumer.connect()]);
  await consumer.subscribe({ topic: config.kafkaRawTopic, fromBeginning: false });

  function publish(position) {
    const previous = queuesByCar.get(position.carId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(() => producer.send({
      topic: config.kafkaLatestTopic,
      acks: -1,
      messages: [{
        key: position.carId,
        value: JSON.stringify(position),
        timestamp: String(position.ts),
      }],
    }));
    queuesByCar.set(position.carId, current);
    return current.finally(() => {
      if (queuesByCar.get(position.carId) === current) queuesByCar.delete(position.carId);
    });
  }

  const filter = new LatestPositionFilter({
    windowSizeMs: config.windowSizeMs,
    onWindowClosed: (position) => publish(position).catch((error) => {
      console.error(`Échec de publication pour ${position.carId}: ${error.message}`);
    }),
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        filter.ingest(JSON.parse(message.value.toString()));
      } catch (error) {
        console.error(`Position brute invalide ignorée: ${error.message}`);
      }
    },
  });

  return {
    filter,
    disconnect: async () => {
      filter.stop();
      await consumer.disconnect();
      await filter.flush();
      await Promise.allSettled([...queuesByCar.values()]);
      await producer.disconnect();
    },
  };
}
