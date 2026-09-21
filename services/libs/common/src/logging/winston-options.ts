import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { ClsServiceManager } from 'nestjs-cls';
import winston from 'winston';
import { CENSOR, SENSITIVE_KEYS } from './redaction';
import { logDirectory } from './pino-options';

/**
 * Walks a log object and censors anything whose key looks like a secret.
 *
 * Pino does this internally in C-like fast paths. Here we do it in plain
 * JavaScript on every single log line — one of the reasons Winston costs more.
 */
function deepRedact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => deepRedact(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? CENSOR
      : deepRedact(val, depth + 1);
  }
  return out;
}

/**
 * A Winston "format": a function that receives the record and returns it.
 *
 * Note that this edits the top-level object **in place** and returns the same
 * reference, rather than building a clean copy. That is deliberate and easy to
 * get wrong: Winston keeps the log's level and rendered message in hidden
 * `Symbol` keys, and `Object.entries` does not see symbols. Returning a rebuilt
 * object silently drops them, and the colouriser then crashes with a confusing
 * `colors[...] is not a function`.
 *
 * Nested values are still replaced with redacted copies, so the caller's own
 * objects are never modified.
 */
const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    const record = info as unknown as Record<string, unknown>;
    record[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? CENSOR
      : deepRedact(record[key], 1);
  }
  return info;
});

/**
 * The Winston equivalent of Pino's `mixin` — reads the request id back out of
 * AsyncLocalStorage and attaches it to the line.
 */
const requestIdFormat = winston.format((info) => {
  try {
    const reqId = ClsServiceManager.getClsService()?.getId();
    if (reqId) info.req_id = reqId;
  } catch {
    // Outside a request (startup). Nothing to attach.
  }
  return info;
});

/**
 * Forces Winston's field names to match Pino's.
 *
 * Winston writes `message` and `timestamp`; Pino writes `msg` and `time`. If
 * we left that alone you would need two different Loki queries depending on
 * which service you were looking at. Normalising here means one query works
 * for both.
 */
const normaliseFormat = winston.format((info) => {
  // In place again, for the same Symbol reason as redactFormat above.
  const record = info as unknown as Record<string, unknown>;
  record.time = record.timestamp;
  record.msg = record.message;
  delete record.timestamp;
  delete record.message;
  return info;
});

export function buildWinstonOptions(serviceName: string): winston.LoggerOptions {
  const level = process.env.LOG_LEVEL ?? 'info';
  const pretty = process.env.LOG_PRETTY !== 'false';
  const dir = logDirectory();
  const logFile = path.join(dir, `${serviceName}.log`);

  // Winston's File transport will not create a missing directory.
  mkdirSync(dir, { recursive: true });

  const transports: winston.transport[] = [
    new winston.transports.File({
      filename: logFile,
      level,
      format: winston.format.combine(
        winston.format.timestamp(),
        requestIdFormat(),
        redactFormat(),
        normaliseFormat(),
        winston.format.json(),
      ),
    }),
  ];

  if (pretty) {
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
    // Stamped on every line, same three fields Pino's `base` adds.
    defaultMeta: {
      service: serviceName,
      env: process.env.NODE_ENV ?? 'development',
      version: process.env.SERVICE_VERSION ?? '0.1.0',
    },
    transports,
  };
}
