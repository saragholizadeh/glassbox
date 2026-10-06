import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { trace } from '@opentelemetry/api';
import { CheckoutItem, CheckoutService } from './checkout.service';
import { SERVICE_NAME } from './constants';

@Controller()
export class AppController {
  constructor(
    @InjectPinoLogger(AppController.name)
    private readonly logger: PinoLogger,
    private readonly cls: ClsService,
    private readonly checkout: CheckoutService,
  ) {}

  @Get()
  info() {
    return {
      service: SERVICE_NAME,
      role: 'The front door. Receives the checkout and calls orders-service.',
      endpoints: ['GET /', 'POST /checkout', 'GET /health/live', 'GET /health/ready'],
      requestId: this.cls.getId(),
    };
  }

  /** The main request of the project: reserve stock, then create the order. */
  @Post('checkout')
  async checkoutOrder(@Body() body: { items?: CheckoutItem[] } = {}) {
    const items = body.items ?? [{ productId: 1, quantity: 1 }];

    this.logger.info({ items: items.length }, 'checkout started');

    await this.checkout.reserve(items);
    const order = await this.checkout.createOrder(items);

    this.logger.info({ orderId: order.orderId }, 'checkout finished');

    return {
      ...order,
      requestId: this.cls.getId(),
      // Paste this into Grafana → Explore → Tempo to see the trace.
      traceId: trace.getActiveSpan()?.spanContext().traceId,
    };
  }
}
