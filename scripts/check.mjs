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

const results = await Promise.all(
  targets.map(async (t) => ({
    ...t,
    ...(t.kind === 'tcp' ? await checkTcp(t) : await checkHttp(t)),
  })),
);

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

console.log(`${RED}${required - requiredOk} of ${required} checks failed.${RESET}`);
console.log(`${DIM}Kafka needs ~20s after 'npm run up'. If it stays down: docker compose logs kafka${RESET}`);
console.log('');
process.exit(1);
