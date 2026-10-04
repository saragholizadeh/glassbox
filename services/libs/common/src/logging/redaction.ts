/**
 * Field names that must never be written to a log file.
 * Their values are replaced with "[Redacted]".
 *
 * Add new names here only. The Pino list below is made from this one.
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

/** Lowercase version, for Winston. Headers can come in any case. */
export const SECRET_FIELDS_LOWER = new Set(
  SECRET_FIELDS.map((field) => field.toLowerCase()),
);

/** The same list in Pino's path format. `*` means "any object". */
export const REDACTED_PATHS = SECRET_FIELDS.flatMap((field) => [
  `*.${field}`,
  `req.headers["${field}"]`,
  `res.headers["${field}"]`,
]);
