import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ClsService } from 'nestjs-cls';
import type { Logger } from 'winston';
import { SERVICE_NAME } from './constants';

@Controller()
export class AppController {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly cls: ClsService,
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

  /** api-gateway calls this. For now it only writes logs. */
  @Post('orders')
  create(@Body() body: { orderId?: number; amountCents?: number }) {
    const orderId = body.orderId ?? Math.floor(Math.random() * 1000);

    this.logger.info('order received', { orderId, amountCents: body.amountCents });
    this.logger.info('order persisted', { orderId, table: 'orders' });

    return { orderId, status: 'created', requestId: this.cls.getId() };
  }
}
