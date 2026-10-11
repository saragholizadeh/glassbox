import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Message, Partitioners } from 'kafkajs';
import { bugOn, createKafka, ORDER_CREATED_TOPIC } from '@app/common';
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

  private buffer: Message[] = [];
  private timer?: NodeJS.Timeout;

  async onModuleInit() {
    await this.producer.connect();

    if (bugOn('broken-trace')) {
      // BUG 4 (see README). Send the waiting messages every 200 ms, in one batch.
      this.timer = setInterval(() => void this.flush(), 200);
    }
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.flush();
    await this.producer.disconnect();
  }

  async orderCreated(orderId: number, amountCents: number) {
    const message: Message = {
      // Messages with the same key always go to the same partition,
      // so events of one order stay in order.
      key: String(orderId),
      value: JSON.stringify({ orderId, amountCents }),
    };

    if (bugOn('broken-trace')) {
      this.buffer.push(message);
      return;
    }

    await this.producer.send({ topic: ORDER_CREATED_TOPIC, messages: [message] });
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const messages = this.buffer.splice(0);
    await this.producer.send({ topic: ORDER_CREATED_TOPIC, messages });
  }
}
