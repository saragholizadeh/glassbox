import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { metrics, trace } from '@opentelemetry/api';
import type { KafkaMessage } from 'kafkajs';
import { createKafka, ORDER_CREATED_TOPIC } from '@app/common';
import { SERVICE_NAME } from './constants';

const tracer = trace.getTracer(SERVICE_NAME);

// Our own metric. A counter only goes up. In Prometheus it is
// called payments_processed_total.
const paymentsProcessed = metrics
  .getMeter(SERVICE_NAME)
  .createCounter('payments.processed', { description: 'Payments charged' });

/**
 * Reads order.created events from Kafka and charges the order.
 * A "consumer" is the Kafka word for a reader.
 *
 * OTel's kafkajs plugin reads `traceparent` from the message headers,
 * so this work joins the same trace as the checkout request.
 */
@Injectable()
export class PaymentsConsumer implements OnModuleInit, OnModuleDestroy {
  // groupId: Kafka remembers how far this group has read.
  // After a restart, we continue where we stopped.
  private readonly consumer = createKafka(SERVICE_NAME).consumer({
    groupId: SERVICE_NAME,
  });

  constructor(
    @InjectPinoLogger(PaymentsConsumer.name)
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: ORDER_CREATED_TOPIC });
    await this.consumer.run({
      eachMessage: ({ message }) => this.handle(message),
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  private async handle(message: KafkaMessage) {
    const { orderId, amountCents } = JSON.parse(message.value?.toString() ?? '{}') as {
      orderId: number;
      amountCents: number;
    };

    this.logger.info({ orderId, amountCents }, 'payment started');

    await tracer.startActiveSpan('charge card', async (span) => {
      span.setAttribute('order.id', orderId);

      // Pretend to call a payment provider.
      await new Promise((resolve) => setTimeout(resolve, 30));

      span.end();
    });

    paymentsProcessed.add(1);
    this.logger.info({ orderId }, 'payment done');
  }
}
