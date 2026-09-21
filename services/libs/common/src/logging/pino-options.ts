import path from 'node:path';
import type { Params as PinoParams } from 'nestjs-pino';
import { ClsServiceManager } from 'nestjs-cls';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
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

  return {
    // A tuple of [options, stream]. The stream is built below.
    pinoHttp: [
      {
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

        formatters: {
          // Pino writes levels as numbers (30, 50). Winston writes words
          // ("info", "error"). Emitting the word here means one Loki query
          // works across every service regardless of which logger it uses.
          level: (label) => ({ level: label }),
        },

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

        customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
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
      },
      buildPinoStream(serviceName),
    ],
  };
}

/**
 * Two destinations at once: your terminal, and a JSON file.
 *
 * Pino offers two ways to do this and the difference matters.
 *
 *   `transport.targets` runs each destination in a **worker thread**. Faster,
 *   because formatting never blocks the request — but nothing that cannot be
 *   sent across a thread boundary is allowed, and a function cannot be. Using
 *   it means giving up the `formatters.level` above, and levels go back to
 *   being numbers that do not match Winston's words.
 *
 *   `multistream` (used here) runs in-process. Slightly slower, but the
 *   formatter works, so both loggers emit the same shape and one Loki query
 *   covers every service.
 *
 * Consistency wins for a project about reading logs. In a throughput-critical
 * production service, the worker-thread version is the better trade.
 */
export function buildPinoStream(serviceName: string): pino.MultiStreamRes {
  const level = process.env.LOG_LEVEL ?? 'info';
  const pretty = process.env.LOG_PRETTY !== 'false';
  const logFile = path.join(logDirectory(), `${serviceName}.log`);

  const streams: pino.StreamEntry[] = [
    {
      level: level as pino.Level,
      // The real output: one JSON object per line, appended to a file.
      stream: pino.destination({ dest: logFile, mkdir: true, sync: false }),
    },
  ];

  if (pretty) {
    streams.push({
      level: level as pino.Level,
      stream: pinoPretty({
        colorize: true,
        singleLine: true,
        // The SYS: prefix means local time. Without it pino-pretty prints UTC,
        // which does not match Winston's console output and quietly makes you
        // doubt your own clock when comparing two services.
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname,service,env,version',
        messageFormat: '{if req_id}[{req_id}] {end}{msg}',
      }),
    });
  }

  return pino.multistream(streams);
}
