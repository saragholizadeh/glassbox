import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ClsService } from 'nestjs-cls';
import type { Logger } from 'winston';
import { SERVICE_NAME } from './constants';
import { OrderEventsService } from './order-events.service';

@Controller()
export class AppController {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly cls: ClsService,
    private readonly events: OrderEventsService,
  ) {}

  @Get()
  info() {
    return {
      service: SERVICE_NAME,
      role: 'Owns orders. Reads Postgres and Redis, publishes order.created to Kafka.',
      logger: 'winston',
      endpoints: ['GET /', 'POST /orders', 'GET /health/live', 'GET /health/ready'],
      requestId: this.cls.getId(),
    };
  }

  /**
   * api-gateway calls this. We tell payments-service about the new order
   * through Kafka, and answer right away. We don't wait for the payment.
   */
  @Post('orders')
  async create(@Body() body: { orderId?: number; amountCents?: number }) {
    const orderId = body.orderId ?? Math.floor(Math.random() * 1000);
    const amountCents = body.amountCents ?? 4200;

    this.logger.info('order received', { orderId, amountCents });

    await this.events.orderCreated(orderId, amountCents);
    this.logger.info('order.created sent to Kafka', { orderId });

    return { orderId, status: 'created', requestId: this.cls.getId() };
  }
}
