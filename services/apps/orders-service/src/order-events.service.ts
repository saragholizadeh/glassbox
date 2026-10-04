import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Partitioners } from 'kafkajs';
import { createKafka, ORDER_CREATED_TOPIC } from '@app/common';
import { SERVICE_NAME } from './constants';

/**
 * Sends events to Kafka. A "producer" is the Kafka word for a sender.
 *
 * We add no tracing code here: OTel's kafkajs plugin puts `traceparent`
 * into the message headers, like it does for HTTP.
 */
@Injectable()
export class OrderEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly producer = createKafka(SERVICE_NAME).producer({
    createPartitioner: Partitioners.DefaultPartitioner,
  });

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async orderCreated(orderId: number, amountCents: number) {
    await this.producer.send({
      topic: ORDER_CREATED_TOPIC,
      messages: [
        {
          // Messages with the same key always go to the same partition,
          // so events of one order stay in order.
          key: String(orderId),
          value: JSON.stringify({ orderId, amountCents }),
        },
      ],
    });
  }
}
