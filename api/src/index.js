import { loadConfig } from './config.js';
import { createKafkaWebSocketApi } from './kafka-websocket-api.js';

const config = loadConfig();
let api;

try {
  api = await createKafkaWebSocketApi(config);
  const address = api.adminServer.address();
  console.log(
    `API Admin à l'écoute sur ws://${config.webSocketHost}:${address.port}${config.webSocketPath}, `
    + `positions consommées depuis ${config.kafkaLatestTopic}.`,
  );
} catch (error) {
  console.error(`Impossible de démarrer l'API Admin: ${error.message}`);
  process.exitCode = 1;
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await api?.close();
  } catch (error) {
    console.error(`Erreur lors de l'arrêt de l'API Admin: ${error.message}`);
    process.exitCode = 1;
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
