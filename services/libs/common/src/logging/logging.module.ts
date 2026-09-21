import { randomUUID } from 'node:crypto';
import { DynamicModule, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule as PinoModule } from 'nestjs-pino';
import { WinstonModule } from 'nest-winston';
import type { IncomingMessage } from 'node:http';
import { buildPinoOptions } from './pino-options';
import { buildWinstonOptions } from './winston-options';
import { HttpLoggerMiddleware } from './http-logger.middleware';

/** Which logging library this service uses. */
export type LogDriver = 'pino' | 'winston';

export interface LoggingOptions {
  /** Stamped on every log line, and used for the log file name. */
  serviceName: string;
  /** Defaults to pino. orders-service uses winston so the two can be compared. */
  driver?: LogDriver;
}

/** Set at import time so the middleware can be mounted conditionally. */
let activeDriver: LogDriver = 'pino';

/**
 * Structured logging plus per-request context, in one import.
 *
 * Whichever driver is chosen, the output shape is identical — same field
 * names, same request id, same redaction, same health-check filtering — so a
 * single Loki query works across every service.
 *
 * Two things are always wired together here:
 *
 *  1. ClsModule — AsyncLocalStorage. Runs before your handlers, generates a
 *     request id, keeps it available for the whole request without anything
 *     having to pass it around.
 *
 *  2. The logger, which reads that id back out and puts it on every line.
 */
@Module({})
export class LoggingModule implements NestModule {
  static forRoot(options: LoggingOptions): DynamicModule {
    const driver = options.driver ?? 'pino';
    activeDriver = driver;

    const clsModule = ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        /**
         * Reuse the caller's request id when there is one, otherwise make a
         * new one.
         *
         * Honouring an incoming `x-request-id` is what lets the id survive a
         * hop between services — and it is also this approach's ceiling. Every
         * service has to remember to forward the header by hand, and it breaks
         * entirely once a message goes through Kafka.
         *
         * Step 3 replaces this with an OpenTelemetry trace id, which crosses
         * those boundaries on its own.
         */
        idGenerator: (req: IncomingMessage) =>
          (req.headers['x-request-id'] as string) || randomUUID(),
      },
    });

    if (driver === 'winston') {
      return {
        module: LoggingModule,
        imports: [
          clsModule,
          WinstonModule.forRoot(buildWinstonOptions(options.serviceName)),
        ],
        providers: [HttpLoggerMiddleware],
        exports: [ClsModule, WinstonModule],
      };
    }

    return {
      module: LoggingModule,
      imports: [clsModule, PinoModule.forRoot(buildPinoOptions(options.serviceName))],
      exports: [ClsModule, PinoModule],
    };
  }

  /**
   * Pino's package mounts its own request logger. Winston has none, so we
   * mount ours only in that case.
   */
  configure(consumer: MiddlewareConsumer): void {
    if (activeDriver === 'winston') {
      consumer.apply(HttpLoggerMiddleware).forRoutes('*');
    }
  }
}
