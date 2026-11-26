import { Kafka, logLevel } from 'kafkajs';
import { createAdminWebSocketServer } from './admin-websocket-server.js';
import { createPostgresPositionRepository } from './persistence/postgres-position-repository.js';

export function createPositionMessageHandler(broadcaster, positionRepository) {
  return async ({ message }) => {
    try {
      const position = JSON.parse(message.value.toString());
      await positionRepository?.save(position);
      broadcaster.broadcast(position);
    } catch (error) {
      console.error(`Position filtrée non traitée: ${error.message}`);
    }
  };
}

export async function createKafkaWebSocketApi(config, dependencies = {}) {
  let consumer = dependencies.consumer;
  const positionRepository = dependencies.positionRepository
    ?? (config.databaseUrl ? createPostgresPositionRepository(config.databaseUrl) : undefined);
  const adminServer = dependencies.adminServer
    ?? await createAdminWebSocketServer(config, { positionRepository });

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
      eachMessage: createPositionMessageHandler(adminServer.broadcaster, positionRepository),
    });
  } catch (error) {
    await Promise.allSettled([
      consumer?.disconnect(),
      adminServer.close(),
      positionRepository?.close(),
    ]);
    throw error;
  }

  return {
    adminServer,
    positionRepository,
    close: async () => {
      await consumer.disconnect();
      await adminServer.close();
      await positionRepository?.close();
    },
  };
}
