import { randomUUID } from 'node:crypto';
import {
  DynamicModule,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule as PinoModule } from 'nestjs-pino';
import { WinstonModule } from 'nest-winston';
import type { IncomingMessage } from 'node:http';
import { buildPinoOptions } from './pino-options';
import { buildWinstonOptions } from './winston-options';
import { HttpLoggerMiddleware } from './http-logger.middleware';

export type LogDriver = 'pino' | 'winston';

export const LOG_DRIVER = 'LOG_DRIVER';

export interface LoggingOptions {
  /** Stamped on every log line, and used for the log file name. */
  serviceName: string;
  /** Defaults to pino. orders-service uses winston so the two can be compared. */
  driver?: LogDriver;
}

/**
 * Structured logging plus per-request context, in one import.
 *
 * Two things are wired together:
 *
 *  1. ClsModule — AsyncLocalStorage. Runs before your handlers, makes a request
 *     id, and keeps it available for the whole request without anything having
 *     to pass it around.
 *
 *  2. The logger, which reads that id back out and puts it on every line.
 *
 * Both drivers produce the same JSON, so one Loki query works everywhere.
 */
@Module({})
export class LoggingModule implements NestModule {
  constructor(@Inject(LOG_DRIVER) private readonly driver: LogDriver) {}

  static forRoot(options: LoggingOptions): DynamicModule {
    const driver = options.driver ?? 'pino';

    const cls = ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        /**
         * Reuse the caller's request id if there is one, otherwise make a new
         * one.
         *
         * Honouring an incoming `x-request-id` is what lets the id survive a
         * hop between services — and it is also this approach's ceiling. Every
         * service has to forward the header by hand, and it breaks entirely
         * once a message goes through Kafka.
         *
         * Step 3 replaces this with an OpenTelemetry trace id, which crosses
         * those boundaries on its own.
         */
        idGenerator: (req: IncomingMessage) =>
          (req.headers['x-request-id'] as string) || randomUUID(),
      },
    });

    const isWinston = driver === 'winston';

    const logger = isWinston
      ? WinstonModule.forRoot(buildWinstonOptions(options.serviceName))
      : PinoModule.forRoot(buildPinoOptions(options.serviceName));

    return {
      module: LoggingModule,
      imports: [cls, logger],
      providers: [
        { provide: LOG_DRIVER, useValue: driver },
        // Only on the Winston path. This middleware injects Winston's logger,
        // which does not exist when Pino is the driver.
        ...(isWinston ? [HttpLoggerMiddleware] : []),
      ],
      exports: [ClsModule, logger],
    };
  }

  /**
   * nestjs-pino mounts its own request logger. Winston has none, so we mount
   * ours only in that case.
   */
  configure(consumer: MiddlewareConsumer): void {
    if (this.driver === 'winston') {
      consumer.apply(HttpLoggerMiddleware).forRoutes('*');
    }
  }
}
