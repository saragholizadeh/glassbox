import path from 'node:path';
import type { Params as PinoParams } from 'nestjs-pino';
import { ClsServiceManager } from 'nestjs-cls';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import { CENSOR, REDACTED_PATHS } from './redaction';

/** Folder for the log files. The OTel Collector reads from here. */
export function logDirectory(): string {
  return process.env.LOG_DIR ?? path.resolve(process.cwd(), '..', 'logs');
}

/** Pino settings for one service. */
export function buildPinoOptions(serviceName: string): PinoParams {
  const level = process.env.LOG_LEVEL ?? 'info';

  return {
    // [settings, where to write]
    pinoHttp: [
      {
        level,

        // Added to every line.
        base: {
          service: serviceName,
          env: process.env.NODE_ENV ?? 'development',
          version: process.env.SERVICE_VERSION ?? '0.1.0',
        },

        // Readable time, like 2026-10-04T10:00:00.000Z
        timestamp: () => `,"time":"${new Date().toISOString()}"`,

        // Write "info" instead of 30, to match Winston.
        formatters: {
          level: (label) => ({ level: label }),
        },

        // Runs for every line. Adds the request id.
        mixin() {
          try {
            const reqId = ClsServiceManager.getClsService()?.getId();
            return reqId ? { req_id: reqId } : {};
          } catch {
            // At startup there is no request, so no id.
            return {};
          }
        },

        redact: {
          paths: REDACTED_PATHS,
          censor: CENSOR,
        },

        // One line per request. Health checks are skipped.
        autoLogging: {
          ignore: (req) => (req.url ?? '').startsWith('/health'),
        },

        // 5xx is an error, 4xx is a warning, the rest is info.
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },

        customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
        customErrorMessage: (req, res) =>
          `${req.method} ${req.url} ${res.statusCode} failed`,

        // Keep request info short. By default Pino logs every header.
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
 * Writes logs to two places: the terminal (colored) and a JSON file.
 *
 * We use `multistream` because the simpler `transport` option does not allow
 * the `formatters.level` setting above.
 */
export function buildPinoStream(serviceName: string): pino.MultiStreamRes {
  const level = process.env.LOG_LEVEL ?? 'info';
  const pretty = process.env.LOG_PRETTY !== 'false';
  const logFile = path.join(logDirectory(), `${serviceName}.log`);

  const streams: pino.StreamEntry[] = [
    {
      level: level as pino.Level,
      // One JSON object per line.
      stream: pino.destination({ dest: logFile, mkdir: true, sync: false }),
    },
  ];

  if (pretty) {
    streams.push({
      level: level as pino.Level,
      stream: pinoPretty({
        colorize: true,
        singleLine: true,
        // SYS: means local time, same as Winston.
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname,service,env,version',
        messageFormat: '{if req_id}[{req_id}] {end}{msg}',
      }),
    });
  }

  return pino.multistream(streams);
}
