import dotenv from 'dotenv'
dotenv.config()

interface EnvRule {
  required: boolean
  validate?: (val: string) => string | null // returns error message or null
}

const rules: Record<string, EnvRule> = {
  JWT_SECRET: {
    required: true,
    validate: (v) => v.length < 32 ? 'must be at least 32 characters' : null,
  },
  DATABASE_URL: {
    required: true,
    validate: (v) => v.startsWith('mysql://') ? null : 'must be a mysql:// connection string',
  },
  ENCRYPTION_KEY: {
    required: true,
    validate: (v) => /^[0-9a-fA-F]{64}$/.test(v) ? null : 'must be a 64-character hex string (openssl rand -hex 32)',
  },
  FRONTEND_URL: {
    required: true,
    validate: (v) => v.startsWith('http') ? null : 'must be a valid URL',
  },
  NODE_ENV: {
    required: true,
    validate: (v) => ['production', 'development', 'test'].includes(v) ? null : 'must be production | development | test',
  },
}

const optional: string[] = ['OPENAI_API_KEY', 'SOCIALBU_ACCESS_TOKEN', 'RAPID_API_KEY']

let failed = false

for (const [key, rule] of Object.entries(rules)) {
  const val = process.env[key]
  if (!val) {
    if (rule.required) {
      console.error(`[env] ❌ ${key} is required but not set`)
      failed = true
    }
    continue
  }
  const err = rule.validate?.(val)
  if (err) {
    console.error(`[env] ❌ ${key}: ${err}`)
    failed = true
  }
}

for (const key of optional) {
  if (!process.env[key]) {
    console.warn(`[env] ⚠️  ${key} is not set — related features will be disabled`)
  }
}

if (failed) {
  console.error('[env] Fix the above environment variables and restart.')
  process.exit(1)
}
