import { Kafka, logLevel } from 'kafkajs';
import { createAdminWebSocketServer } from './admin-websocket-server.js';

export function createPositionMessageHandler(broadcaster) {
  return async ({ message }) => {
    try {
      const position = JSON.parse(message.value.toString());
      broadcaster.broadcast(position);
    } catch (error) {
      console.error(`Position filtrée invalide ignorée: ${error.message}`);
    }
  };
}

export async function createKafkaWebSocketApi(config, dependencies = {}) {
  const adminServer = dependencies.adminServer
    ?? await createAdminWebSocketServer(config);
  let consumer = dependencies.consumer;

  try {
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
      eachMessage: createPositionMessageHandler(adminServer.broadcaster),
    });
  } catch (error) {
    await Promise.allSettled([consumer?.disconnect(), adminServer.close()]);
    throw error;
  }

  return {
    adminServer,
    close: async () => {
      await consumer.disconnect();
      await adminServer.close();
    },
  };
}
