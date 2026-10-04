import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { NextFunction, Request, Response } from 'express';

/**
 * Writes one log line per HTTP request, for Winston.
 * Pino does this by itself; Winston does not.
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip health checks.
    if (req.originalUrl.startsWith('/health')) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();

    // 'finish' runs when the response is sent. Now we know status and time.
    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      const level =
        res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

      this.logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, {
        req: {
          method: req.method,
          url: req.originalUrl,
          remoteAddress: req.ip,
        },
        res: { statusCode: res.statusCode },
        responseTime: Math.round(durationMs),
      });
    });

    next();
  }
}
