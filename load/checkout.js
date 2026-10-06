// k6 load test: many fake users do checkouts at the same time.
// Run with:  npm run load

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3001';

export const options = {
  // How many users, and for how long.
  stages: [
    { duration: '30s', target: 20 }, // go from 0 to 20 users
    { duration: '1m', target: 20 }, // stay at 20 users
    { duration: '30s', target: 0 }, // go back to 0
  ],

  // The test fails if these are not true.
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests faster than 500 ms
    http_req_failed: ['rate<0.01'], // less than 1% errors
  },
};

// Each user runs this again and again.
export default function () {
  const orderId = Math.floor(Math.random() * 10000);

  const res = http.post(`${BASE_URL}/checkout`, JSON.stringify({ orderId }), {
    headers: { 'content-type': 'application/json' },
  });

  check(res, { 'status is 201': (r) => r.status === 201 });

  // A real user waits a bit between clicks.
  sleep(1);
}
