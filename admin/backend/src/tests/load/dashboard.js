/**
 * k6 load test — GET /api/management/dashboard
 * Run: k6 run --env BASE_URL=http://your-vps:5001 --env TOKEN=<jwt> src/tests/load/dashboard.js
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const errorRate = new Rate('errors')
const dashboardDuration = new Trend('dashboard_duration', true)

export const options = {
  stages: [
    { duration: '10s', target: 5 },   // ramp up
    { duration: '30s', target: 20 },  // sustained load
    { duration: '10s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95th percentile < 2s
    errors: ['rate<0.01'],              // error rate < 1%
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001'
const TOKEN = __ENV.TOKEN || ''

export default function () {
  const res = http.get(`${BASE_URL}/api/management/dashboard`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    timeout: '10s',
  })

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'has statistics': (r) => {
      try {
        return JSON.parse(r.body).statistics !== undefined
      } catch {
        return false
      }
    },
    'response time < 2s': (r) => r.timings.duration < 2000,
  })

  errorRate.add(!ok)
  dashboardDuration.add(res.timings.duration)

  sleep(1)
}
