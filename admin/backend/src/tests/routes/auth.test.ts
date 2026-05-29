import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import bcrypt from 'bcryptjs'

const mockDb = vi.mocked(db)

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'secret' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when both fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 401 when user does not exist', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid credentials/i)
  })

  it('returns 403 when user role is not admin or superadmin', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 5,
      email: 'customer@test.com',
      name: 'Customer',
      password: await bcrypt.hash('password', 10),
      roleId: 2,
      avatar: null,
      role: { name: 'user' },
    })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@test.com', password: 'password' })

    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/admin access only/i)
  })

  it('returns 401 when password is wrong', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: 'admin@test.com',
      name: 'Admin',
      password: await bcrypt.hash('correctpassword', 10),
      roleId: 1,
      avatar: null,
      role: { name: 'admin' },
    })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid credentials/i)
  })

  it('returns 200 with token and user on valid admin credentials', async () => {
    const hashedPassword = await bcrypt.hash('secret123', 10)
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: 'admin@test.com',
      name: 'Admin User',
      password: hashedPassword,
      roleId: 1,
      avatar: null,
      role: { id: 1, name: 'admin' },
    })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'secret123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(typeof res.body.token).toBe('string')
    expect(res.body.user.email).toBe('admin@test.com')
    expect(res.body.user.role).toBe('admin')
    // Password should not be returned
    expect(res.body.user).not.toHaveProperty('password')
  })

  it('returns 200 with token for superadmin', async () => {
    const hashedPassword = await bcrypt.hash('superpass', 10)
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 2,
      email: 'superadmin@test.com',
      name: 'Super Admin',
      password: hashedPassword,
      roleId: 1,
      avatar: 'https://example.com/avatar.png',
      role: { id: 1, name: 'superadmin' },
    })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'superadmin@test.com', password: 'superpass' })

    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('superadmin')
    expect(res.body.user.avatar).toBe('https://example.com/avatar.png')
  })

  it('token is a valid JWT with correct payload', async () => {
    const hashedPassword = await bcrypt.hash('password', 10)
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 7,
      email: 'admin7@test.com',
      name: 'Admin Seven',
      password: hashedPassword,
      roleId: 1,
      avatar: null,
      role: { id: 1, name: 'admin' },
    })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin7@test.com', password: 'password' })

    expect(res.status).toBe(200)

    // Decode JWT without verifying to check structure
    const parts = res.body.token.split('.')
    expect(parts).toHaveLength(3)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    expect(payload.userId).toBe(7)
    expect(payload.email).toBe('admin7@test.com')
    expect(payload.roleName).toBe('admin')
  })
})
