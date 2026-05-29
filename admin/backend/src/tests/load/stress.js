/**
 * k6 stress test — find the breaking point of the API
 * Run: k6 run --env BASE_URL=http://your-vps:5001 --env TOKEN=<jwt> src/tests/load/stress.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const errorRate = new Rate('errors')

export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '20s', target: 50 },
    { duration: '20s', target: 100 },
    { duration: '20s', target: 200 },  // expected breaking point
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.20'],  // allow up to 20% errors under stress
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001'
const TOKEN = __ENV.TOKEN || ''

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/health`, null, { timeout: '10s' }],
    [
      'POST',
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: 'stress@invalid.local', password: 'stress_wrong' }),
      { headers: { 'Content-Type': 'application/json' }, timeout: '10s' },
    ],
    [
      'GET',
      `${BASE_URL}/api/management/dashboard`,
      null,
      { headers: { Authorization: `Bearer ${TOKEN}` }, timeout: '10s' },
    ],
  ])

  const ok = responses.every((r) =>
    check(r, { 'not a 5xx': (res) => res.status < 500 })
  )

  errorRate.add(!ok)
  sleep(0.2)
}
