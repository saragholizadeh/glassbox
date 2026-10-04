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
  /** Added to every log line and used as the log file name. */
  serviceName: string;
  /** pino by default. orders-service uses winston, to compare the two. */
  driver?: LogDriver;
}

/**
 * JSON logs with a request id on every line.
 *
 * ClsModule makes a request id and keeps it for the whole request
 * (AsyncLocalStorage). The logger reads it and adds it to each line.
 * Both drivers write the same JSON.
 */
@Module({})
export class LoggingModule implements NestModule {
  constructor(@Inject(LOG_DRIVER) private readonly driver: LogDriver) {}

  static forRoot(options: LoggingOptions): DynamicModule {
    const driver = options.driver ?? 'pino';
    const isWinston = driver === 'winston';

    const cls = ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        // Use the caller's x-request-id if it sent one, otherwise make a new id.
        idGenerator: (req: IncomingMessage) =>
          (req.headers['x-request-id'] as string) || randomUUID(),
      },
    });

    const logger = isWinston
      ? WinstonModule.forRoot(buildWinstonOptions(options.serviceName))
      : PinoModule.forRoot(buildPinoOptions(options.serviceName));

    return {
      module: LoggingModule,
      imports: [cls, logger],
      providers: [
        { provide: LOG_DRIVER, useValue: driver },
        // Winston only. This middleware needs Winston's logger.
        ...(isWinston ? [HttpLoggerMiddleware] : []),
      ],
      exports: [ClsModule, logger],
    };
  }

  /** Pino logs each request by itself. Winston needs our middleware. */
  configure(consumer: MiddlewareConsumer): void {
    if (this.driver === 'winston') {
      consumer.apply(HttpLoggerMiddleware).forRoutes('*');
    }
  }
}
