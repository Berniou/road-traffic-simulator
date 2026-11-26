const DEFAULTS = Object.freeze({
  windowSizeMs: 300,
  kafkaBrokers: ['localhost:9092'],
  kafkaClientId: 'latest-position-filter',
  kafkaGroupId: 'latest-position-filter',
  kafkaRawTopic: 'car.positions.raw',
  kafkaLatestTopic: 'car.positions.latest',
});

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} doit être un entier supérieur ou égal à 1.`);
  }
  return parsed;
}

export function loadConfig(env = process.env) {
  return {
    windowSizeMs: env.WINDOW_SIZE_MS === undefined
      ? DEFAULTS.windowSizeMs
      : positiveInteger(env.WINDOW_SIZE_MS, 'WINDOW_SIZE_MS'),
    kafkaBrokers: env.KAFKA_BROKERS?.split(',').map((broker) => broker.trim()).filter(Boolean)
      ?? DEFAULTS.kafkaBrokers,
    kafkaClientId: env.KAFKA_CLIENT_ID ?? DEFAULTS.kafkaClientId,
    kafkaGroupId: env.KAFKA_GROUP_ID ?? DEFAULTS.kafkaGroupId,
    kafkaRawTopic: env.KAFKA_RAW_TOPIC ?? DEFAULTS.kafkaRawTopic,
    kafkaLatestTopic: env.KAFKA_LATEST_TOPIC ?? DEFAULTS.kafkaLatestTopic,
    kafkaTopicPartitions: env.KAFKA_TOPIC_PARTITIONS === undefined
      ? 1
      : positiveInteger(env.KAFKA_TOPIC_PARTITIONS, 'KAFKA_TOPIC_PARTITIONS'),
    kafkaReplicationFactor: env.KAFKA_REPLICATION_FACTOR === undefined
      ? 1
      : positiveInteger(env.KAFKA_REPLICATION_FACTOR, 'KAFKA_REPLICATION_FACTOR'),
  };
}
