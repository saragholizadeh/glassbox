import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ClsService } from 'nestjs-cls';
import type { Logger } from 'winston';
import { SERVICE_NAME } from './constants';
import { OrderEventsService } from './order-events.service';
import { OrderItemInput, OrdersService } from './orders.service';

@Controller()
export class AppController {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly cls: ClsService,
    private readonly orders: OrdersService,
    private readonly events: OrderEventsService,
  ) {}

  @Get()
  info() {
    return {
      service: SERVICE_NAME,
      role: 'Owns orders. Reads Postgres and Redis, publishes order.created to Kafka.',
      logger: 'winston',
      endpoints: [
        'GET /',
        'POST /orders',
        'GET /orders',
        'GET /health/live',
        'GET /health/ready',
      ],
      requestId: this.cls.getId(),
    };
  }

  /**
   * api-gateway calls this. We save the order, then tell payments-service
   * through Kafka, and answer right away. We don't wait for the payment.
   */
  @Post('orders')
  async create(@Body() body: { items?: OrderItemInput[] } = {}) {
    const items = body.items ?? [{ productId: 1, quantity: 1 }];

    this.logger.info('order received', { items: items.length });

    const { orderId, totalCents } = await this.orders.create(items);
    this.logger.info('order saved', { orderId, totalCents });

    await this.events.orderCreated(orderId, totalCents);
    this.logger.info('order.created sent to Kafka', { orderId });

    return { orderId, totalCents, status: 'created', requestId: this.cls.getId() };
  }

  /** The latest orders with their items. Try: GET /orders?limit=50 */
  @Get('orders')
  latest(@Query('limit') limit = '20') {
    return this.orders.latest(Math.min(Number(limit) || 20, 100));
  }
}
