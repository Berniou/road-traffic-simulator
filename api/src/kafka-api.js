import { Kafka, logLevel } from 'kafkajs';
import { createNotifierClient } from './notifier-client.js';
import { createPostgresPositionRepository } from './persistence/postgres-position-repository.js';

export function createPositionMessageHandler(notifier, positionRepository) {
  return async ({ message }) => {
    try {
      const position = JSON.parse(message.value.toString());
      await positionRepository?.save(position);
      await notifier.notify(position);
    } catch (error) {
      console.error(`Position filtrée non traitée: ${error.message}`);
    }
  };
}

export async function createKafkaApi(config, dependencies = {}) {
  let consumer = dependencies.consumer;
  const positionRepository = dependencies.positionRepository
    ?? (config.databaseUrl ? createPostgresPositionRepository(config.databaseUrl) : undefined);
  const notifier = dependencies.notifier ?? createNotifierClient({ url: config.notifierUrl });

  try {
    await positionRepository?.initialize();
    if (!consumer) {
      const kafka = new Kafka({
        clientId: config.kafkaClientId,
        brokers: config.kafkaBrokers,
        logLevel: logLevel.ERROR,
      });
      consumer = kafka.consumer({ groupId: config.kafkaGroupId });
    }

    await consumer.connect();
    await consumer.subscribe({ topic: config.kafkaLatestTopic, fromBeginning: false });
    await consumer.run({
      eachMessage: createPositionMessageHandler(notifier, positionRepository),
    });
  } catch (error) {
    await Promise.allSettled([
      consumer?.disconnect(),
      positionRepository?.close(),
    ]);
    throw error;
  }

  return {
    notifier,
    positionRepository,
    close: async () => {
      await consumer.disconnect();
      await positionRepository?.close();
    },
  };
}
