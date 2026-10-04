import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { ClsServiceManager } from 'nestjs-cls';
import winston from 'winston';
import { CENSOR, SECRET_FIELDS_LOWER } from './redaction';
import { logDirectory } from './pino-options';

/** Replaces secret values with "[Redacted]", also inside nested objects. */
function deepRedact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => deepRedact(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_FIELDS_LOWER.has(key.toLowerCase())
      ? CENSOR
      : deepRedact(val, depth + 1);
  }
  return out;
}

/**
 * Winston has no redaction, so we do it ourselves.
 *
 * We change the log object in place. Do not return a new object: Winston
 * keeps the level in hidden Symbol keys, and a copy loses them.
 */
const redactFormat = winston.format((info) => {
  const record = info as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    record[key] = SECRET_FIELDS_LOWER.has(key.toLowerCase())
      ? CENSOR
      : deepRedact(record[key], 1);
  }
  return info;
});

/** Adds the request id to the line. Same job as Pino's `mixin`. */
const requestIdFormat = winston.format((info) => {
  try {
    const reqId = ClsServiceManager.getClsService()?.getId();
    if (reqId) info.req_id = reqId;
  } catch {
    // At startup there is no request, so no id.
  }
  return info;
});

/**
 * Renames Winston's fields to match Pino's: message → msg, timestamp → time.
 * Then one Loki query works for all services.
 */
const renameFormat = winston.format((info) => {
  const record = info as unknown as Record<string, unknown>;
  record.time = record.timestamp;
  record.msg = record.message;
  delete record.timestamp;
  delete record.message;
  return info;
});

/** Winston settings for one service. */
export function buildWinstonOptions(serviceName: string): winston.LoggerOptions {
  const level = process.env.LOG_LEVEL ?? 'info';
  const pretty = process.env.LOG_PRETTY !== 'false';
  const dir = logDirectory();
  const logFile = path.join(dir, `${serviceName}.log`);

  // Winston does not create the folder by itself.
  mkdirSync(dir, { recursive: true });

  const transports: winston.transport[] = [
    // The JSON file.
    new winston.transports.File({
      filename: logFile,
      level,
      format: winston.format.combine(
        winston.format.timestamp(),
        requestIdFormat(),
        redactFormat(),
        renameFormat(),
        winston.format.json(),
      ),
    }),
  ];

  if (pretty) {
    // The colored terminal output.
    transports.push(
      new winston.transports.Console({
        level,
        format: winston.format.combine(
          winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
          requestIdFormat(),
          redactFormat(),
          winston.format.colorize({ level: true }),
          winston.format.printf((info) => {
            const { timestamp, level: lvl, message, req_id, context, ...meta } = info;
            const id = req_id ? `[${String(req_id).slice(0, 8)}] ` : '';
            const ctx = context ? `(${String(context)}) ` : '';
            const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] ${lvl}: ${id}${ctx}${String(message)}${extra}`;
          }),
        ),
      }),
    );
  }

  return {
    level,
    // Added to every line, same as Pino's `base`.
    defaultMeta: {
      service: serviceName,
      env: process.env.NODE_ENV ?? 'development',
      version: process.env.SERVICE_VERSION ?? '0.1.0',
    },
    transports,
  };
}
