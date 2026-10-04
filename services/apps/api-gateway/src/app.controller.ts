import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { trace } from '@opentelemetry/api';
import { CheckoutService } from './checkout.service';
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
      role: 'The front door. Receives the checkout and (from step 4) calls orders-service.',
      endpoints: ['GET /', 'POST /checkout', 'GET /health/live', 'GET /health/ready'],
      requestId: this.cls.getId(),
    };
  }

  /** The main request of the project. From step 4 it calls orders-service. */
  @Post('checkout')
  async checkoutOrder(@Body() body: { orderId?: number; amountCents?: number }) {
    const orderId = body.orderId ?? 99;
    const amountCents = body.amountCents ?? 4200;

    this.logger.info({ orderId, amountCents }, 'checkout started');

    const result = await this.checkout.reserve(orderId, amountCents);

    this.logger.info({ orderId }, 'checkout finished');

    return {
      status: 'stub',
      requestId: this.cls.getId(),
      // Paste this into Grafana → Explore → Tempo to see the trace.
      traceId: trace.getActiveSpan()?.spanContext().traceId,
      ...result,
    };
  }
}
