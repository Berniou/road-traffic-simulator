import { loadConfig } from './config.js';
import { FleetSimulator } from './simulator.js';

const config = loadConfig();
const simulator = new FleetSimulator(config, (position) => {
  if (process.env.LOG_POSITIONS === 'true') {
    console.log(JSON.stringify(position));
  }
});

simulator.start();

console.log(
  `Simulateur démarré avec ${simulator.vehicles.length} véhicule(s) `
  + `(identifiants : ${simulator.vehicles.map(({ carId }) => carId).join(', ')}).`,
);

function shutdown() {
  simulator.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
