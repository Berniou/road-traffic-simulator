const DEFAULTS = Object.freeze({
  kafkaBrokers: ['localhost:9092'],
  kafkaClientId: 'admin-position-api',
  kafkaGroupId: 'admin-position-api',
  kafkaLatestTopic: 'car.positions.latest',
  databaseUrl: 'postgresql://postgres:postgres@localhost:5432/fleet',
  notifierUrl: 'http://localhost:8080',
});

export function loadConfig(env = process.env) {
  return {
    kafkaBrokers: env.KAFKA_BROKERS?.split(',').map((broker) => broker.trim()).filter(Boolean)
      ?? DEFAULTS.kafkaBrokers,
    kafkaClientId: env.KAFKA_CLIENT_ID ?? DEFAULTS.kafkaClientId,
    kafkaGroupId: env.KAFKA_GROUP_ID ?? DEFAULTS.kafkaGroupId,
    kafkaLatestTopic: env.KAFKA_LATEST_TOPIC ?? DEFAULTS.kafkaLatestTopic,
    databaseUrl: env.DATABASE_URL ?? DEFAULTS.databaseUrl,
    notifierUrl: env.NOTIFIER_URL ?? DEFAULTS.notifierUrl,
  };
}
