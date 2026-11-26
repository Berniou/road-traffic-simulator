import { Kafka, logLevel } from 'kafkajs';

export class KafkaPositionPublisher {
  constructor({ producer, topic }) {
    this.producer = producer;
    this.topic = topic;
    this.queuesByCar = new Map();
  }

  publish(position) {
    const previous = this.queuesByCar.get(position.carId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(() => this.producer.send({
      topic: this.topic,
      acks: -1,
      messages: [{
        key: position.carId,
        value: JSON.stringify(position),
        timestamp: String(position.ts),
      }],
    }));

    this.queuesByCar.set(position.carId, current);

    return current.finally(() => {
      if (this.queuesByCar.get(position.carId) === current) {
        this.queuesByCar.delete(position.carId);
      }
    });
  }

  async flush() {
    await Promise.all(this.queuesByCar.values());
  }
}

export async function createKafkaPositionPublisher(config) {
  const kafka = new Kafka({
    clientId: config.kafkaClientId,
    brokers: config.kafkaBrokers,
    logLevel: logLevel.ERROR,
  });
  const admin = kafka.admin();

  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [{
        topic: config.kafkaRawTopic,
        numPartitions: config.kafkaTopicPartitions,
        replicationFactor: config.kafkaReplicationFactor,
      }],
    });
  } finally {
    await admin.disconnect();
  }

  const producer = kafka.producer({
    idempotent: true,
    maxInFlightRequests: 1,
  });
  await producer.connect();

  return {
    publisher: new KafkaPositionPublisher({ producer, topic: config.kafkaRawTopic }),
    disconnect: () => producer.disconnect(),
  };
}
