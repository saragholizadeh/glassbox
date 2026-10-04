#!/usr/bin/env node
/**
 * Pino vs Winston: which is faster?
 *
 * Run with:  npm run bench:loggers
 *
 * Both write the same JSON lines to a file. No colors, no terminal output.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import pino from 'pino';
import winston from 'winston';

const LINES = Number(process.env.BENCH_LINES ?? 200_000);

/** Lines written first, without timing, so Node can "warm up". Makes the test fair. */
const WARMUP = Math.min(20_000, Math.floor(LINES / 10));

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glassbox-bench-'));

/** The data on every line. */
function payload(i) {
  return {
    orderId: i,
    amountCents: 4200 + (i % 100),
    currency: 'EUR',
    customerCountry: 'AT',
    attempt: (i % 3) + 1,
  };
}

async function benchPino() {
  const dest = pino.destination({
    dest: path.join(outDir, 'pino.log'),
    sync: false,
    minLength: 4096,
  });

  const logger = pino(
    {
      level: 'info',
      base: { service: 'bench', env: 'bench', version: '0.1.0' },
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      formatters: { level: (label) => ({ level: label }) },
    },
    dest,
  );

  for (let i = 0; i < WARMUP; i++) logger.info(payload(i), 'warmup');

  const started = performance.now();
  for (let i = 0; i < LINES; i++) {
    logger.info(payload(i), 'order processed');
  }
  await new Promise((resolve) => dest.flush(resolve));
  return performance.now() - started;
}

async function benchWinston() {
  const logger = winston.createLogger({
    level: 'info',
    defaultMeta: { service: 'bench', env: 'bench', version: '0.1.0' },
    transports: [
      new winston.transports.File({
        filename: path.join(outDir, 'winston.log'),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  });

  for (let i = 0; i < WARMUP; i++) logger.info('warmup', payload(i));

  const started = performance.now();
  for (let i = 0; i < LINES; i++) {
    logger.info('order processed', payload(i));
  }

  // Stop the timer only after everything is written to disk.
  // If we stop earlier, Winston looks much faster than it really is.
  await new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });

  return performance.now() - started;
}

function row(name, ms) {
  const perSec = Math.round(LINES / (ms / 1000));
  const perLine = (ms * 1000) / LINES;
  return { name, ms: ms.toFixed(0), perSec, perLine: perLine.toFixed(2) };
}

console.log(
  `\n  Writing ${LINES.toLocaleString()} JSON lines with each logger` +
    ` (after ${WARMUP.toLocaleString()} untimed warmup lines)...\n`,
);

const pinoMs = await benchPino();
const winstonMs = await benchWinston();

const results = [row('pino', pinoMs), row('winston', winstonMs)];
const fastest = Math.min(pinoMs, winstonMs);

console.log('  logger    total      lines/sec     µs/line   relative');
console.log('  ' + '-'.repeat(54));
for (const r of results) {
  const ratio = (Number(r.ms) / fastest).toFixed(2);
  console.log(
    `  ${r.name.padEnd(9)} ${(r.ms + 'ms').padEnd(10)} ` +
      `${r.perSec.toLocaleString().padStart(11)}   ${r.perLine.padStart(7)}   ${ratio}x`,
  );
}

const sizes = ['pino', 'winston'].map((n) => ({
  n,
  bytes: fs.statSync(path.join(outDir, `${n}.log`)).size,
}));
console.log('');
for (const s of sizes) {
  console.log(`  ${s.n.padEnd(9)} wrote ${(s.bytes / 1_000_000).toFixed(1)} MB`);
}
console.log('');

fs.rmSync(outDir, { recursive: true, force: true });
