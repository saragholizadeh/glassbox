import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
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
      role: 'Public entry point. Receives the checkout request and calls orders-service.',
      endpoints: ['GET /', 'POST /checkout', 'GET /health/live', 'GET /health/ready'],
      requestId: this.cls.getId(),
    };
  }

  /**
   * The request every diagram in the project follows.
   *
   * Step 4 makes this call orders-service over HTTP. For now it logs its way
   * through a couple of layers so you can watch one request id tie the lines
   * together.
   */
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
      ...result,
      note: 'Wired to orders-service in step 4 — see docs/step-04-propagation.md',
    };
  }
}
