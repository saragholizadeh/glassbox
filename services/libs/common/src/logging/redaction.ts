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
  // (Pino path syntax — see SENSITIVE_KEYS below for the Winston equivalent.)
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

/**
 * The same secrets, as plain key names.
 *
 * Winston has no redaction feature at all, so we walk the log object by hand
 * and censor any key in this set, at any depth. Pino's path syntax does not
 * translate, which is why the same rule is expressed twice.
 *
 * Lowercased, because header names arrive in every capitalisation imaginable.
 */
export const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'password',
  'passwordconfirmation',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'cardnumber',
  'cvv',
  'pan',
]);

export const CENSOR = '[Redacted]';
