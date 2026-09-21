import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { NextFunction, Request, Response } from 'express';

/**
 * One log line per finished HTTP request.
 *
 * `nestjs-pino` ships this behaviour (as pino-http) and you never see it.
 * Winston has no equivalent, so here it is written out — which is a good way
 * to see exactly what that "free" feature was actually doing.
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Same rule as the Pino side: health probes run forever and say nothing.
    if (req.originalUrl.startsWith('/health')) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();

    // 'finish' fires once the response has been fully sent, which is the only
    // moment the status code and duration are both known.
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
