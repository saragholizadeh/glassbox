/**
 * Bugs added on purpose, to practise finding them. All are off by default.
 * Turn one on in .env, then restart:  BUGS=event-loop
 */
export type Bug = 'event-loop';

export function bugOn(bug: Bug): boolean {
  return (process.env.BUGS ?? '')
    .split(',')
    .map((name) => name.trim())
    .includes(bug);
}
