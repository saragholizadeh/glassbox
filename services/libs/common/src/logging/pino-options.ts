import path from 'node:path';
import type { Params as PinoParams } from 'nestjs-pino';
import { ClsServiceManager } from 'nestjs-cls';
import { REDACTED_PATHS } from './redaction';

/** Where the JSON log files go. The OTel Collector tails this directory. */
export function logDirectory(): string {
  return process.env.LOG_DIR ?? path.resolve(process.cwd(), '..', 'logs');
}

/**
 * Builds the Pino configuration for one service.
 *
 * Two destinations at once:
 *   - your terminal, prettified and coloured, for you
 *   - a JSON file, for the machines
 */
export function buildPinoOptions(serviceName: string): PinoParams {
  const level = process.env.LOG_LEVEL ?? 'info';
  const pretty = process.env.LOG_PRETTY !== 'false';
  const logFile = path.join(logDirectory(), `${serviceName}.log`);

  return {
    pinoHttp: {
      level,

      // Fields stamped onto EVERY line, so you can filter by service in Loki.
      base: {
        service: serviceName,
        env: process.env.NODE_ENV ?? 'development',
        version: process.env.SERVICE_VERSION ?? '0.1.0',
      },

      // ISO timestamps instead of Unix milliseconds. Costs a little speed,
      // but a log you cannot read at a glance is a log you will not read.
      timestamp: () => `,"time":"${new Date().toISOString()}"`,

      /**
       * Runs once per log line and merges whatever it returns into that line.
       *
       * This is where the request id gets attached — without a single call
       * site having to know about it. The value comes out of AsyncLocalStorage,
       * so each concurrent request reads its own.
       */
      mixin() {
        try {
          const cls = ClsServiceManager.getClsService();
          const reqId = cls?.getId();
          return reqId ? { req_id: reqId } : {};
        } catch {
          // Logging during bootstrap happens outside any request. That is
          // fine — there is simply no id to attach yet.
          return {};
        }
      },

      redact: {
        paths: REDACTED_PATHS,
        censor: '[Redacted]',
      },

      // One line per HTTP request, written when the response finishes.
      autoLogging: {
        // Health checks run every few seconds forever. Without this, they are
        // the overwhelming majority of your logs and you pay to store them.
        ignore: (req) => (req.url ?? '').startsWith('/health'),
      },

      // A 500 is an error, a 404 is a warning, everything else is routine.
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },

      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} ${res.statusCode}`,
      customErrorMessage: (req, res) =>
        `${req.method} ${req.url} ${res.statusCode} failed`,

      // Keep the request/response objects small. By default Pino logs every
      // header on every request, which is mostly noise you pay to store.
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },

      transport: {
        targets: [
          ...(pretty
            ? [
                {
                  target: 'pino-pretty',
                  level,
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'HH:MM:ss.l',
                    ignore: 'pid,hostname,service,env,version',
                    messageFormat: '{if req_id}[{req_id}] {end}{msg}',
                  },
                },
              ]
            : []),
          {
            // The real output: one JSON object per line, appended to a file.
            target: 'pino/file',
            level,
            options: { destination: logFile, mkdir: true },
          },
        ],
      },
    },
  };
}
