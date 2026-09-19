#!/usr/bin/env node
/** Printed after `npm run up`, so the URLs are in front of you. */

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

console.log(`
  ${BOLD}Grafana${RESET}      http://localhost:3000   ${DIM}the screen you actually look at${RESET}
  ${BOLD}Kafka UI${RESET}     http://localhost:8080   ${DIM}messages, and their headers${RESET}
  Prometheus   http://localhost:9090
  Tempo        http://localhost:3200
  Loki         http://localhost:3100

  ${DIM}Kafka, Tempo and Loki need ~20s to report healthy.${RESET}
  ${DIM}Run 'npm run check' to confirm, then 'npm run dev'.${RESET}
`);
