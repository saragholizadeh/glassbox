#!/usr/bin/env node
/**
 * `npm run check` — is the stack actually up?
 *
 * Containers reporting "running" is not the same as "working". This pokes each
 * one at the address your services will really use and prints a table.
 */

import net from 'node:net';

const TIMEOUT_MS = 3000;

const targets = [
  { group: 'data', name: 'Postgres', kind: 'tcp', host: 'localhost', port: 5432 },
  { group: 'data', name: 'Redis', kind: 'tcp', host: 'localhost', port: 6379 },
  { group: 'data', name: 'Kafka', kind: 'tcp', host: 'localhost', port: 29092 },

  { group: 'telemetry', name: 'OTel Collector (gRPC)', kind: 'tcp', host: 'localhost', port: 4317 },
  { group: 'telemetry', name: 'OTel Collector (metrics)', kind: 'http', url: 'http://localhost:8889/metrics' },
  { group: 'telemetry', name: 'Tempo', kind: 'http', url: 'http://localhost:3200/ready' },
  { group: 'telemetry', name: 'Loki', kind: 'http', url: 'http://localhost:3100/ready' },
  { group: 'telemetry', name: 'Prometheus', kind: 'http', url: 'http://localhost:9090/-/ready' },
  { group: 'telemetry', name: 'Grafana', kind: 'http', url: 'http://localhost:3000/api/health' },
  { group: 'telemetry', name: 'Kafka UI', kind: 'http', url: 'http://localhost:8080/actuator/health' },

  { group: 'services', name: 'api-gateway', kind: 'http', url: 'http://localhost:3001/health/ready', optional: true },
  { group: 'services', name: 'orders-service', kind: 'http', url: 'http://localhost:3002/health/ready', optional: true },
  { group: 'services', name: 'payments-service', kind: 'http', url: 'http://localhost:3003/health/ready', optional: true },
];

function checkTcp({ host, port }) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok, detail) => {
      socket.destroy();
      resolve({ ok, detail });
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once('connect', () => done(true, `${host}:${port}`));
    socket.once('timeout', () => done(false, 'timed out'));
    socket.once('error', (err) => done(false, err.code ?? err.message));
    socket.connect(port, host);
  });
}

async function checkHttp({ url }) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err.cause?.code ?? err.name };
  }
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const GROUP_LABELS = {
  data: 'Data stores',
  telemetry: 'Telemetry stack',
  services: 'NestJS services',
};

const probe = (t) => (t.kind === 'tcp' ? checkTcp(t) : checkHttp(t));

/**
 * Keep retrying until everything required is up, or we give up.
 *
 * Nothing here is instant. Kafka takes ~20s to elect itself leader, and Tempo
 * and Loki answer 503 for their first half-minute while their internal rings
 * form. A single pass right after `npm run up` reports failures that fix
 * themselves, which teaches you to distrust your own tooling.
 */
const WAIT_SECONDS = Number(process.env.CHECK_WAIT ?? 90);
const deadline = Date.now() + WAIT_SECONDS * 1000;

let results = [];
let waited = false;

for (;;) {
  results = await Promise.all(
    targets.map(async (t) => ({ ...t, ...(await probe(t)) })),
  );

  const missing = results.filter((r) => !r.ok && !r.optional);
  if (missing.length === 0 || Date.now() >= deadline) break;

  if (!waited) {
    process.stdout.write(`\n  waiting for ${missing.map((m) => m.name).join(', ')}`);
    waited = true;
  }
  process.stdout.write('.');
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

if (waited) process.stdout.write('\n');

let required = 0;
let requiredOk = 0;
let lastGroup = null;

console.log('');
for (const r of results) {
  if (r.group !== lastGroup) {
    if (lastGroup !== null) console.log('');
    console.log(`${DIM}${GROUP_LABELS[r.group]}${RESET}`);
    lastGroup = r.group;
  }

  if (!r.optional) {
    required += 1;
    if (r.ok) requiredOk += 1;
  }

  const mark = r.ok ? `${GREEN}ok  ${RESET}` : r.optional ? `${YELLOW}--  ${RESET}` : `${RED}FAIL${RESET}`;
  const note = r.ok ? `${DIM}${r.detail}${RESET}` : r.optional ? `${DIM}not running${RESET}` : `${RED}${r.detail}${RESET}`;
  console.log(`  ${mark} ${r.name.padEnd(26)} ${note}`);
}

console.log('');

if (requiredOk === required) {
  console.log(`${GREEN}Infrastructure is up${RESET} (${requiredOk}/${required}).`);
  const servicesUp = results.filter((r) => r.group === 'services' && r.ok).length;
  if (servicesUp === 0) {
    console.log(`${DIM}Services are not running yet — start them with: npm run dev${RESET}`);
  }
  console.log('');
  process.exit(0);
}

console.log(
  `${RED}${required - requiredOk} of ${required} checks failed${RESET}` +
    ` ${DIM}after waiting ${WAIT_SECONDS}s.${RESET}`,
);
console.log(`${DIM}Look at the logs of whatever failed, e.g.  docker compose logs tempo${RESET}`);
console.log('');
process.exit(1);
