/**
 * Smoke test — run after deploy to verify core functions are alive.
 * Usage: node scripts/smoke.mjs [BASE_URL]
 * Example: node scripts/smoke.mjs http://your-vps:5001
 */

const BASE_URL = process.argv[2] || 'http://localhost:5001'

let passed = 0
let failed = 0

async function check(name, fn) {
  const start = Date.now()
  try {
    await fn()
    const ms = Date.now() - start
    console.log(`  ✅  ${name} (${ms}ms)`)
    passed++
  } catch (err) {
    console.error(`  ❌  ${name}: ${err.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(5000),
  })
  return { res, body: await res.json().catch(() => ({})) }
}

console.log(`\nSmoke test → ${BASE_URL}\n`)

// 1. Health check
await check('GET /health returns 200 { status: ok }', async () => {
  const { res, body } = await fetchJson('/health')
  assert(res.status === 200, `Expected 200, got ${res.status}`)
  assert(body.status === 'ok', `Expected { status: 'ok' }, got ${JSON.stringify(body)}`)
})

// 2. Response time < 300ms
await check('GET /health responds in < 300ms', async () => {
  const start = Date.now()
  const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(300) })
  const ms = Date.now() - start
  assert(res.status === 200, `Expected 200`)
  assert(ms < 300, `Too slow: ${ms}ms`)
})

// 3. Auth middleware works (no token → 401)
await check('GET /api/management/dashboard without token → 401', async () => {
  const { res } = await fetchJson('/api/management/dashboard')
  assert(res.status === 401, `Expected 401, got ${res.status}`)
})

// 4. DB is connected — bad login returns 401 not 500
await check('POST /api/auth/login with bad creds → 401 (DB alive)', async () => {
  const { res } = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'smoke@test.invalid', password: 'wrong' }),
  })
  assert(res.status === 401, `Expected 401 (DB connected), got ${res.status}`)
})

// 5. Rate limiter header present
await check('Auth endpoint returns rate-limit headers', async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
    signal: AbortSignal.timeout(5000),
  })
  const hasRateHeader =
    res.headers.has('x-ratelimit-limit') ||
    res.headers.has('ratelimit-limit') ||
    res.headers.has('x-ratelimit-remaining')
  assert(hasRateHeader, 'No rate-limit header found')
})

// 6. CORS header present for frontend origin
await check('Response includes CORS headers', async () => {
  const res = await fetch(`${BASE_URL}/health`, {
    headers: { Origin: process.env.FRONTEND_URL || 'http://localhost:5174' },
    signal: AbortSignal.timeout(5000),
  })
  const cors = res.headers.get('access-control-allow-origin')
  assert(cors !== null, 'Missing Access-Control-Allow-Origin header')
})

console.log(`\n${passed + failed} checks — ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
