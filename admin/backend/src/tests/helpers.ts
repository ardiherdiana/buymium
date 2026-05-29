import jwt from 'jsonwebtoken'
import type { JwtPayload } from '../middleware/auth'

const JWT_SECRET = 'test-secret-key-for-vitest-suite-only'

export function makeAdminToken(overrides: Partial<JwtPayload> = {}): string {
  const payload: JwtPayload = {
    userId: 1,
    email: 'admin@buymium.com',
    roleName: 'admin',
    roleId: 1,
    ...overrides,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
}

export function makeSuperAdminToken(overrides: Partial<JwtPayload> = {}): string {
  return makeAdminToken({ roleName: 'superadmin', roleId: 1, ...overrides })
}

export function makeUserToken(overrides: Partial<JwtPayload> = {}): string {
  const payload: JwtPayload = {
    userId: 99,
    email: 'user@example.com',
    roleName: 'user',
    roleId: 2,
    ...overrides,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
}

export function makeExpiredToken(): string {
  const payload: JwtPayload = {
    userId: 1,
    email: 'admin@buymium.com',
    roleName: 'admin',
    roleId: 1,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' })
}
