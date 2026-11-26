import { loadConfig } from './config.js';
import { createKafkaPositionPublisher } from './kafka-publisher.js';
import { loadRoutes } from './routes.js';
import { FleetSimulator } from './simulator.js';

const config = loadConfig();
let publisher;
let disconnectKafka;
let simulator;

try {
  const kafka = await createKafkaPositionPublisher(config);
  publisher = kafka.publisher;
  disconnectKafka = kafka.disconnect;

  const routes = await loadRoutes(config);
  simulator = new FleetSimulator({ ...config, routes }, (position) => {
    if (process.env.LOG_POSITIONS === 'true') {
      console.log(JSON.stringify(position));
    }

    publisher.publish(position).catch((error) => {
      console.error(`Échec de publication pour ${position.carId}: ${error.message}`);
    });
  });

  simulator.start();
  console.log(
    `${simulator.vehicles.length} véhicule(s) publient sur ${config.kafkaRawTopic} `
    + `toutes les ${config.positionIntervalMs} ms.`,
  );
} catch (error) {
  console.error(`Impossible de démarrer le simulateur: ${error.message}`);
  process.exitCode = 1;
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  simulator?.stop();

  try {
    await publisher?.flush();
  } catch (error) {
    console.error(`Certaines positions n'ont pas pu être publiées: ${error.message}`);
  } finally {
    await disconnectKafka?.();
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
