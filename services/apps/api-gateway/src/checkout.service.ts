import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/**
 * Deliberately two layers deep and holding no request id of its own.
 *
 * Notice what is NOT in these method signatures: nothing is passed in to
 * identify the request. The id still appears on every line below, because
 * AsyncLocalStorage carries it — including across the `await`, which is the
 * part a plain variable could never survive.
 */
@Injectable()
export class CheckoutService {
  constructor(
    @InjectPinoLogger(CheckoutService.name)
    private readonly logger: PinoLogger,
  ) {}

  async reserve(orderId: number, amountCents: number) {
    this.logger.info({ orderId, amountCents }, 'reserving stock');

    // Stand-in for real work. The id survives this gap.
    await new Promise((resolve) => setTimeout(resolve, 15));

    this.logger.info({ orderId }, 'stock reserved');
    return { orderId, reserved: true };
  }
}
