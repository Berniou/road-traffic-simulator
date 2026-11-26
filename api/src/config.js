const DEFAULTS = Object.freeze({
  webSocketHost: '0.0.0.0',
  webSocketPort: 8080,
  webSocketPath: '/ws',
  kafkaBrokers: ['localhost:9092'],
  kafkaClientId: 'admin-position-api',
  kafkaGroupId: 'admin-position-api',
  kafkaLatestTopic: 'car.positions.latest',
  databaseUrl: 'postgresql://postgres:postgres@localhost:5432/fleet',
});

function port(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error('WEBSOCKET_PORT doit être un port valide.');
  }
  return parsed;
}

export function loadConfig(env = process.env) {
  return {
    webSocketHost: env.WEBSOCKET_HOST ?? DEFAULTS.webSocketHost,
    webSocketPort: env.WEBSOCKET_PORT === undefined
      ? DEFAULTS.webSocketPort
      : port(env.WEBSOCKET_PORT),
    webSocketPath: env.WEBSOCKET_PATH ?? DEFAULTS.webSocketPath,
    kafkaBrokers: env.KAFKA_BROKERS?.split(',').map((broker) => broker.trim()).filter(Boolean)
      ?? DEFAULTS.kafkaBrokers,
    kafkaClientId: env.KAFKA_CLIENT_ID ?? DEFAULTS.kafkaClientId,
    kafkaGroupId: env.KAFKA_GROUP_ID ?? DEFAULTS.kafkaGroupId,
    kafkaLatestTopic: env.KAFKA_LATEST_TOPIC ?? DEFAULTS.kafkaLatestTopic,
    databaseUrl: env.DATABASE_URL ?? DEFAULTS.databaseUrl,
  };
}
