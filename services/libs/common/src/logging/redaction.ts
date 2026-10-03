/**
 * Field names that must never reach a log file.
 *
 * Logs get copied, shipped elsewhere, kept for months, and read by people who
 * were never meant to see a customer's password. Both loggers replace these
 * values with "[Redacted]" before anything is written, so the secret never
 * exists in the output.
 *
 * Add new names here only. The Pino paths below are generated from this list,
 * so the two loggers can never drift apart.
 */
export const SECRET_FIELDS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'cardNumber',
  'cvv',
];

export const CENSOR = '[Redacted]';

/** Lowercased, for Winston's by-hand matching. Headers arrive in any case. */
export const SECRET_FIELDS_LOWER = new Set(
  SECRET_FIELDS.map((field) => field.toLowerCase()),
);

/**
 * The same rule in Pino's path syntax: `*` matches one level, and names with
 * dashes need bracket-and-quote form.
 */
export const REDACTED_PATHS = SECRET_FIELDS.flatMap((field) => [
  `*.${field}`,
  `req.headers["${field}"]`,
  `res.headers["${field}"]`,
]);
