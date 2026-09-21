/**
 * Fields that must never reach a log file.
 *
 * Logs get copied, shipped to third parties, kept for months and read by
 * people who were never meant to see a customer's password. Redaction is not
 * paranoia — it is the difference between a log store and a breach.
 *
 * Pino replaces these with "[Redacted]" before anything is written, so the
 * secret never exists in the output at all.
 *
 * Syntax: dots walk into nested objects, `*` matches any one level, and keys
 * with dashes or dots in them need bracket-and-quote form.
 */
export const REDACTED_PATHS = [
  // Anything that identifies a caller
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',

  // Anything that looks like a secret, wherever it appears one level deep
  '*.password',
  '*.passwordConfirmation',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.apiKey',

  // Payment details — never log these, anywhere, for any reason
  '*.cardNumber',
  '*.cvv',
  '*.pan',
];
