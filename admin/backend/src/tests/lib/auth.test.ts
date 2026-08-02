import { describe, it, expect, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { generateToken, requireAdmin, requireSuperAdmin } from '../../middleware/auth'
import type { JwtPayload } from '../../middleware/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'secret'

describe('generateToken', () => {
  it('returns a valid JWT string', () => {
    const token = generateToken(1, 'admin@test.com', 'admin', 1)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3) // header.payload.signature
  })

  it('embeds correct payload fields', () => {
    const token = generateToken(42, 'super@test.com', 'superadmin', 1)
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    expect(decoded.userId).toBe(42)
    expect(decoded.email).toBe('super@test.com')
    expect(decoded.roleName).toBe('superadmin')
    expect(decoded.roleId).toBe(1)
  })

  it('sets expiry of 7 days', () => {
    const before = Math.floor(Date.now() / 1000)
    const token = generateToken(1, 'admin@test.com', 'admin', 1)
    const decoded = jwt.decode(token) as jwt.JwtPayload
    const after = Math.floor(Date.now() / 1000)

    const sevenDays = 7 * 24 * 60 * 60
    expect(decoded.exp).toBeGreaterThanOrEqual(before + sevenDays - 5)
    expect(decoded.exp).toBeLessThanOrEqual(after + sevenDays + 5)
  })

  it('generates different tokens for different users', () => {
    const token1 = generateToken(1, 'a@test.com', 'admin', 1)
    const token2 = generateToken(2, 'b@test.com', 'admin', 1)
    expect(token1).not.toBe(token2)
  })
})

interface MockRes {
  _status?: number
  _body?: unknown
  status: (code: number) => MockRes
  json: (body: unknown) => MockRes
}

describe('requireAdmin middleware', () => {
  const mockNext = () => {}
  const makeReq = (token?: string) => ({
    headers: token ? { authorization: `Bearer ${token}` } : {},
    user: undefined as JwtPayload | undefined,
  })
  const makeRes = (): MockRes => {
    const res = {} as MockRes
    res.status = (code: number) => { res._status = code; return res }
    res.json = (body: unknown) => { res._body = body; return res }
    return res
  }

  it('calls next() when token is valid and role is admin', () => {
    const token = generateToken(1, 'admin@test.com', 'admin', 1)
    const req = makeReq(token) as unknown as import('express').Request
    const res = makeRes()
    let nextCalled = false
    requireAdmin(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
    expect(req.user).toBeDefined()
    expect(req.user.roleName).toBe('admin')
  })

  it('returns 403 when role is superadmin (requireAdmin only allows exact "admin")', () => {
    const token = generateToken(1, 'super@test.com', 'superadmin', 1)
    const req = makeReq(token) as unknown as import('express').Request
    const res = makeRes()
    let nextCalled = false
    requireAdmin(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(false)
    expect(res._status).toBe(403)
  })

  it('returns 401 when no token is provided', () => {
    const req = makeReq() as unknown as import('express').Request
    const res = makeRes()
    requireAdmin(req, res, mockNext as unknown as import('express').NextFunction)
    expect(res._status).toBe(401)
    expect(res._body.error).toMatch(/missing/i)
  })

  it('returns 401 when token is invalid', () => {
    const req = makeReq('this-is-not-a-valid-token') as unknown as import('express').Request
    const res = makeRes()
    requireAdmin(req, res, mockNext as unknown as import('express').NextFunction)
    expect(res._status).toBe(401)
    expect(res._body.error).toMatch(/invalid/i)
  })

  it('returns 403 when role is not admin or superadmin', () => {
    const token = jwt.sign(
      { userId: 99, email: 'user@test.com', roleName: 'user', roleId: 2 },
      JWT_SECRET,
      { expiresIn: '1h' }
    )
    const req = makeReq(token) as unknown as import('express').Request
    const res = makeRes()
    requireAdmin(req, res, mockNext as unknown as import('express').NextFunction)
    expect(res._status).toBe(403)
    expect(res._body.error).toMatch(/admin/i)
  })
})

// requireSuperAdmin is currently an alias for requireAdmin (see middleware/auth.ts) —
// there is no separate superadmin tier, so any admin-role token is authorized.
describe('requireSuperAdmin middleware', () => {
  const mockNext = () => {}
  const makeReq = (token?: string) => ({
    headers: token ? { authorization: `Bearer ${token}` } : {},
    user: undefined as JwtPayload | undefined,
  })
  const makeRes = (): MockRes => {
    const res = {} as MockRes
    res.status = (code: number) => { res._status = code; return res }
    res.json = (body: unknown) => { res._body = body; return res }
    return res
  }

  it('returns 403 when role is superadmin (alias only allows exact "admin")', () => {
    const token = generateToken(1, 'super@test.com', 'superadmin', 1)
    const req = makeReq(token) as unknown as import('express').Request
    const res = makeRes()
    let nextCalled = false
    requireSuperAdmin(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(false)
    expect(res._status).toBe(403)
  })

  it('calls next() when role is admin (alias of requireAdmin)', () => {
    const token = generateToken(1, 'admin@test.com', 'admin', 1)
    const req = makeReq(token) as unknown as import('express').Request
    const res = makeRes()
    let nextCalled = false
    requireSuperAdmin(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
  })

  it('returns 403 when role is neither admin nor superadmin', () => {
    const token = jwt.sign(
      { userId: 99, email: 'user@test.com', roleName: 'user', roleId: 2 },
      JWT_SECRET,
      { expiresIn: '1h' }
    )
    const req = makeReq(token) as unknown as import('express').Request
    const res = makeRes()
    requireSuperAdmin(req, res, mockNext as unknown as import('express').NextFunction)
    expect(res._status).toBe(403)
    expect(res._body.error).toMatch(/admin/i)
  })

  it('returns 401 when no token provided', () => {
    const req = makeReq() as unknown as import('express').Request
    const res = makeRes()
    requireSuperAdmin(req, res, mockNext as unknown as import('express').NextFunction)
    expect(res._status).toBe(401)
  })
})
