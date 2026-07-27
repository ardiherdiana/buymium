import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import app from '../../app'
import { mockDb } from '../setup'
import { makeUserToken } from '../helpers'

const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'user@test.com',
  password: bcrypt.hashSync('password123', 10),
  roleId: 2,
  avatar: '',
  googleId: null,
  createdAt: new Date(),
}

describe('POST /api/auth/login', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'pass' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validasi gagal')
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validasi gagal')
  })

  it('returns 400 when email is invalid format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'pass' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validasi gagal')
  })

  it('returns 401 when user not found', async () => {
    mockDb.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Email atau password salah')
  })

  it('returns 401 when password is wrong', async () => {
    mockDb.user.findUnique.mockResolvedValue(mockUser)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'wrongpassword' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Email atau password salah')
  })

  it('returns 200 with token and user on valid credentials', async () => {
    mockDb.user.findUnique.mockResolvedValue(mockUser)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe('user@test.com')
    expect(res.body.user.id).toBe(1)
  })
})

describe('POST /api/auth/google', () => {
  it('returns 400 when credential is missing', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validasi gagal')
  })

  it('returns 200 with token for valid google credential (new user)', async () => {
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({
      id: 2,
      name: 'Test User',
      email: 'test@gmail.com',
      roleId: 2,
      avatar: 'https://pic.url/photo.jpg',
      googleId: 'google-id-123',
      createdAt: new Date(),
    })

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'header.payload.signature' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe('test@gmail.com')
  })

  it('returns 200 with token for valid google credential (existing user)', async () => {
    const existingUser = {
      id: 2,
      name: 'Test User',
      email: 'test@gmail.com',
      roleId: 2,
      avatar: '',
      googleId: 'google-id-123',
      createdAt: new Date(),
    }
    mockDb.user.findUnique.mockResolvedValue(existingUser)
    mockDb.user.update.mockResolvedValue({
      ...existingUser,
      avatar: 'https://pic.url/photo.jpg',
    })

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'header.payload.signature' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
  })
})

describe('GET /api/auth/me', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Tidak diizinkan')
  })

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Token tidak valid')
  })

  it('returns 200 with user when token is valid', async () => {
    const user = {
      id: 1,
      name: 'Test User',
      email: 'user@test.com',
      roleId: 2,
      avatar: '',
      createdAt: new Date(),
    }
    mockDb.user.findUnique.mockResolvedValue(user)

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${makeUserToken(1)}`)

    expect(res.status).toBe(200)
    expect(res.body.email).toBe('user@test.com')
  })

  it('returns 404 when user is not in database', async () => {
    mockDb.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${makeUserToken(999)}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('User tidak ditemukan')
  })
})
