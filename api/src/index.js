import { loadConfig } from './config.js';
import { createKafkaApi } from './kafka-api.js';

const config = loadConfig();
let api;

try {
  api = await createKafkaApi(config);
  console.log(
    `API connectée à Kafka (${config.kafkaLatestTopic}) et au notificateur ${config.notifierUrl}.`,
  );
} catch (error) {
  console.error(`Impossible de démarrer l'API: ${error.message}`);
  process.exitCode = 1;
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await api?.close();
  } catch (error) {
    console.error(`Erreur lors de l'arrêt de l'API: ${error.message}`);
    process.exitCode = 1;
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
