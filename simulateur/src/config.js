const DEFAULTS = Object.freeze({
  vehicleCount: 7,
  positionIntervalMs: 50,
  kafkaTopicPartitions: 1,
  kafkaReplicationFactor: 1,
  kafkaBrokers: ['localhost:9092'],
  kafkaClientId: 'vehicle-simulator',
  kafkaRawTopic: 'car.positions.raw',
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
    vehicleCount: env.VEHICLE_COUNT === undefined
      ? DEFAULTS.vehicleCount
      : positiveInteger(env.VEHICLE_COUNT, 'VEHICLE_COUNT'),
    positionIntervalMs: env.POSITION_INTERVAL_MS === undefined
      ? DEFAULTS.positionIntervalMs
      : positiveInteger(env.POSITION_INTERVAL_MS, 'POSITION_INTERVAL_MS'),
    kafkaTopicPartitions: env.KAFKA_TOPIC_PARTITIONS === undefined
      ? DEFAULTS.kafkaTopicPartitions
      : positiveInteger(env.KAFKA_TOPIC_PARTITIONS, 'KAFKA_TOPIC_PARTITIONS'),
    kafkaReplicationFactor: env.KAFKA_REPLICATION_FACTOR === undefined
      ? DEFAULTS.kafkaReplicationFactor
      : positiveInteger(env.KAFKA_REPLICATION_FACTOR, 'KAFKA_REPLICATION_FACTOR'),
    kafkaBrokers: env.KAFKA_BROKERS?.split(',').map((broker) => broker.trim()).filter(Boolean)
      ?? DEFAULTS.kafkaBrokers,
    kafkaClientId: env.KAFKA_CLIENT_ID ?? DEFAULTS.kafkaClientId,
    kafkaRawTopic: env.KAFKA_RAW_TOPIC ?? DEFAULTS.kafkaRawTopic,
  };
}
