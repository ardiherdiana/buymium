import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import type { Request, Response } from 'express'
import { makeUserToken, makeAdminToken } from '../helpers'

interface DecodedToken {
  userId: number
  email: string
  roleId: number
  exp: number
}

const JWT_SECRET = process.env.JWT_SECRET!

describe('generateToken / signToken', () => {
  it('makeUserToken returns a valid JWT with correct payload', () => {
    const token = makeUserToken(42)
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken

    expect(decoded.userId).toBe(42)
    expect(decoded.email).toBe('user@test.com')
    expect(decoded.roleId).toBe(2)
  })

  it('makeAdminToken returns a valid JWT with roleId=1', () => {
    const token = makeAdminToken(99)
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken

    expect(decoded.userId).toBe(99)
    expect(decoded.roleId).toBe(1)
  })

  it('token expires after 1 day', () => {
    const token = makeUserToken(1)
    const decoded = jwt.decode(token) as DecodedToken

    const now = Math.floor(Date.now() / 1000)
    const oneDayFromNow = now + 86400

    expect(decoded.exp).toBeGreaterThan(now)
    expect(decoded.exp).toBeLessThanOrEqual(oneDayFromNow + 300)
  })
})

describe('requireAuth middleware', () => {
  it('rejects requests with no Authorization header', async () => {
    const { requireAuth } = await import('../../middleware/auth')

    const req = { headers: {}, ip: '127.0.0.1', method: 'GET', path: '/test' } as unknown as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Tidak diizinkan' })
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects requests with malformed Authorization header', async () => {
    const { requireAuth } = await import('../../middleware/auth')

    const req = {
      headers: { authorization: 'Basic sometoken' },
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
    } as unknown as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects requests with invalid/expired token', async () => {
    const { requireAuth } = await import('../../middleware/auth')

    const req = {
      headers: { authorization: 'Bearer this.is.invalid' },
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
    } as unknown as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token tidak valid' })
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next and sets req.user for valid token', async () => {
    const { requireAuth } = await import('../../middleware/auth')
    const token = makeUserToken(5)

    const req = {
      headers: { authorization: `Bearer ${token}` },
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
    } as unknown as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.user).toBeDefined()
    expect(req.user!.userId).toBe(5)
  })
})

describe('requireAdmin middleware', () => {
  it('rejects non-admin users with 403', async () => {
    const { requireAdmin } = await import('../../middleware/auth')
    const token = makeUserToken(1)

    const req = {
      headers: { authorization: `Bearer ${token}` },
      ip: '127.0.0.1',
      method: 'GET',
      path: '/admin',
    } as unknown as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response
    const next = vi.fn()

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Akses ditolak' })
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next for admin users (roleId=1)', async () => {
    const { requireAdmin } = await import('../../middleware/auth')
    const token = makeAdminToken(99)

    const req = {
      headers: { authorization: `Bearer ${token}` },
      ip: '127.0.0.1',
      method: 'GET',
      path: '/admin',
    } as unknown as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response
    const next = vi.fn()

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })
})
