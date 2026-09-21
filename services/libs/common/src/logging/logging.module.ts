import { randomUUID } from 'node:crypto';
import { DynamicModule, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule as PinoModule } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import { buildPinoOptions } from './pino-options';

export interface LoggingOptions {
  /** Stamped on every log line, and used for the log file name. */
  serviceName: string;
}

/**
 * Structured logging plus per-request context, in one import.
 *
 * Two things are wired together here:
 *
 *  1. ClsModule — AsyncLocalStorage. It runs before your handlers, generates
 *     a request id, and keeps it available for the whole request without
 *     anything having to pass it around.
 *
 *  2. PinoModule — the logger. Its `mixin` reads that id back out and puts it
 *     on every line.
 */
@Module({})
export class LoggingModule {
  static forRoot(options: LoggingOptions): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            generateId: true,
            /**
             * Reuse the caller's request id when there is one, otherwise make
             * a new one.
             *
             * Honouring an incoming `x-request-id` is what lets the id survive
             * a hop between services — and it is also this approach's ceiling.
             * Every service has to remember to forward the header by hand, and
             * it breaks entirely once a message goes through Kafka.
             *
             * Step 3 replaces this with an OpenTelemetry trace id, which
             * crosses those boundaries on its own.
             */
            idGenerator: (req: IncomingMessage) =>
              (req.headers['x-request-id'] as string) || randomUUID(),
          },
        }),
        PinoModule.forRoot(buildPinoOptions(options.serviceName)),
      ],
      exports: [ClsModule, PinoModule],
    };
  }
}
