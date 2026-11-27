import { loadConfig } from './config.js';
import { createNotificationServer } from './notification-server.js';
import { createPostgresPositionRepository } from './persistence/postgres-position-repository.js';

const config = loadConfig();
let notifier;
let positionRepository;

try {
  positionRepository = createPostgresPositionRepository(config.databaseUrl);
  await positionRepository.initialize();
  notifier = await createNotificationServer(config, { positionRepository });
  const address = notifier.address();
  console.log(
    `Notificateur à l'écoute sur http://${config.host}:${address.port} `
    + `(WebSocket ${config.webSocketPath}, notification POST /notify).`,
  );
} catch (error) {
  console.error(`Impossible de démarrer le notificateur: ${error.message}`);
  process.exitCode = 1;
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await notifier?.close();
    await positionRepository?.close();
  } catch (error) {
    console.error(`Erreur lors de l'arrêt du notificateur: ${error.message}`);
    process.exitCode = 1;
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
