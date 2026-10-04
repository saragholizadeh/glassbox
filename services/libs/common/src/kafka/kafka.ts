import { Kafka, logLevel } from 'kafkajs';

/** orders-service writes to this topic. payments-service reads from it. */
export const ORDER_CREATED_TOPIC = 'order.created';

/** A Kafka client. clientId is the name Kafka shows for this app. */
export function createKafka(clientId: string): Kafka {
  return new Kafka({
    clientId,
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:29092').split(','),
    // Only show kafkajs warnings and errors, not every connect message.
    logLevel: logLevel.WARN,
  });
}
