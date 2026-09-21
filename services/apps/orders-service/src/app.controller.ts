import { Controller, Get, Inject, Post } from '@nestjs/common';
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

  /**
   * Called by api-gateway from step 4 onwards. For now it just logs, so the
   * Winston output can be compared against the gateway's Pino output.
   */
  @Post('orders')
  create() {
    const orderId = Math.floor(Math.random() * 1000);

    this.logger.info('order received', { orderId });
    this.logger.info('order persisted', { orderId, table: 'orders' });

    return { orderId, status: 'created', requestId: this.cls.getId() };
  }
}
