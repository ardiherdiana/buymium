/**
 * k6 load test — POST /api/auth/login
 * Run: k6 run --env BASE_URL=http://your-vps:5001 src/tests/load/login.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const errorRate = new Rate('errors')

export const options = {
  stages: [
    { duration: '5s', target: 5 },
    { duration: '20s', target: 10 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // auth must be fast
    errors: ['rate<0.05'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001'

export default function () {
  // Use invalid creds — we only test that the endpoint responds, not that login succeeds
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: 'loadtest@invalid.local', password: 'wrong_password_load_test' }),
    { headers: { 'Content-Type': 'application/json' }, timeout: '5s' }
  )

  const ok = check(res, {
    'returns 401 not 500': (r) => r.status === 401,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has error field': (r) => {
      try { return !!JSON.parse(r.body).error } catch { return false }
    },
  })

  errorRate.add(!ok)
  sleep(0.5)
}
