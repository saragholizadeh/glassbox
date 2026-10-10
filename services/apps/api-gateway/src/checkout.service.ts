import { BadGatewayException, HttpException, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { trace } from '@opentelemetry/api';
import { pbkdf2, pbkdf2Sync } from 'node:crypto';
import { promisify } from 'node:util';
import { bugOn } from '@app/common';
import { SERVICE_NAME } from './constants';

const tracer = trace.getTracer(SERVICE_NAME);
const pbkdf2Async = promisify(pbkdf2);

// A slow hash: about 40 ms of CPU work.
const HASH_ROUNDS = 100_000;

export interface CheckoutItem {
  productId: number;
  quantity?: number;
}

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

  async reserve(items: CheckoutItem[]) {
    // A manual span. OTel times HTTP requests by itself, but it does not
    // know about our own code. This makes "reserve stock" a step in the trace.
    return tracer.startActiveSpan('reserve stock', async (span) => {
      // Attributes are extra info you can see on the span in Grafana.
      span.setAttribute('items.count', items.length);

      this.logger.info({ items: items.length }, 'reserving stock');

      // Pretend to do some work.
      await new Promise((resolve) => setTimeout(resolve, 15));

      this.logger.info('stock reserved');

      span.end();
    });
  }

  /**
   * Calls orders-service. We add no tracing code here: OTel adds a
   * `traceparent` header to the request, so the trace continues there.
   */
  async createOrder(items: CheckoutItem[]) {
    const ordersUrl = process.env.ORDERS_URL ?? 'http://localhost:3002';

    let res: Response;
    try {
      res = await fetch(`${ordersUrl}/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      });
    } catch {
      // No answer at all: orders-service is down.
      this.logger.error('orders-service is not reachable');
      throw new BadGatewayException('orders-service is not reachable');
    }

    // 4xx: the user sent something wrong (like an unknown product). Pass it on.
    if (res.status >= 400 && res.status < 500) {
      throw new HttpException((await res.json()) as object, res.status);
    }

    // 5xx: orders-service is broken.
    if (!res.ok) {
      this.logger.error({ status: res.status }, 'orders-service failed');
      throw new BadGatewayException('orders-service failed');
    }

    return (await res.json()) as { orderId: number; totalCents: number; status: string };
  }

  /** A receipt code for the order. Made with a slow hash, like a password. */
  async receiptCode(orderId: number): Promise<string> {
    const input = String(orderId);

    if (bugOn('event-loop')) {
      // BUG 1 (see README). The Sync version blocks Node: while it runs,
      // no other request can be served.
      const hash = pbkdf2Sync(input, 'glassbox', HASH_ROUNDS, 16, 'sha512');
      return hash.toString('hex');
    }

    // The async version runs on a worker thread. Node keeps serving other requests.
    const hash = await pbkdf2Async(input, 'glassbox', HASH_ROUNDS, 16, 'sha512');
    return hash.toString('hex');
  }
}
