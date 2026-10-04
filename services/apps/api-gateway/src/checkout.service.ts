import { BadGatewayException, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { trace } from '@opentelemetry/api';
import { SERVICE_NAME } from './constants';

const tracer = trace.getTracer(SERVICE_NAME);

/**
 * Notice: no request id is passed in. The logs still have it, because
 * AsyncLocalStorage carries it — even across the `await`.
 */
@Injectable()
export class CheckoutService {
  constructor(
    @InjectPinoLogger(CheckoutService.name)
    private readonly logger: PinoLogger,
  ) {}

  async reserve(orderId: number, amountCents: number) {
    // A manual span. OTel times HTTP requests by itself, but it does not
    // know about our own code. This makes "reserve stock" a step in the trace.
    return tracer.startActiveSpan('reserve stock', async (span) => {
      // Attributes are extra info you can see on the span in Grafana.
      span.setAttribute('order.id', orderId);

      this.logger.info({ orderId, amountCents }, 'reserving stock');

      // Pretend to do some work.
      await new Promise((resolve) => setTimeout(resolve, 15));

      this.logger.info({ orderId }, 'stock reserved');

      span.end();
      return { orderId, reserved: true };
    });
  }

  /**
   * Calls orders-service. We add no tracing code here: OTel adds a
   * `traceparent` header to the request, so the trace continues there.
   */
  async createOrder(orderId: number, amountCents: number) {
    const ordersUrl = process.env.ORDERS_URL ?? 'http://localhost:3002';

    const res = await fetch(`${ordersUrl}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, amountCents }),
    });

    if (!res.ok) {
      this.logger.error({ orderId, status: res.status }, 'orders-service failed');
      throw new BadGatewayException('orders-service failed');
    }

    return (await res.json()) as { orderId: number; status: string };
  }
}
