import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const SECURITY_LOG = path.join(LOG_DIR, 'security.log')
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

function writeLog(level: string, event: string, meta: Record<string, unknown>) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...meta })
  fs.appendFileSync(SECURITY_LOG, entry + '\n')
  console.log(`[Security][${level}] ${event}`, meta)
}

export const securityLogger = {
  loginFailed: (email: string, ip: string, reason: string) =>
    writeLog('WARN', 'LOGIN_FAILED', { email, ip, reason }),
  loginSuccess: (userId: number, email: string, ip: string) =>
    writeLog('INFO', 'LOGIN_SUCCESS', { userId, email, ip }),
  unauthorized: (path: string, ip: string, method: string) =>
    writeLog('WARN', 'UNAUTHORIZED_ACCESS', { path, ip, method }),
  forbidden: (userId: number, path: string, ip: string) =>
    writeLog('WARN', 'FORBIDDEN_ACCESS', { userId, path, ip }),
  rateLimitHit: (ip: string, path: string) =>
    writeLog('WARN', 'RATE_LIMIT_HIT', { ip, path }),
}
