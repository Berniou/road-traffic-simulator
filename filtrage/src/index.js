import { loadConfig } from './config.js';
import { createKafkaFilter } from './kafka-filter.js';

const config = loadConfig();
let kafkaFilter;

try {
  kafkaFilter = await createKafkaFilter(config);
  console.log(
    `Filtrage de ${config.kafkaRawTopic} vers ${config.kafkaLatestTopic} `
    + `en fenêtres fixes de ${config.windowSizeMs} ms.`,
  );
} catch (error) {
  console.error(`Impossible de démarrer le filtrage: ${error.message}`);
  process.exitCode = 1;
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await kafkaFilter?.disconnect();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
