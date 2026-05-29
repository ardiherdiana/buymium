import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken, makeUserToken } from '../helpers'

const mockDb = vi.mocked(db)

const adminToken = makeAdminToken()
const authHeader = `Bearer ${adminToken}`
const userToken = makeUserToken()

const mockUser = {
  id: 10,
  name: 'John Doe',
  email: 'john@example.com',
  roleId: 2,
  avatar: null,
  createdAt: new Date().toISOString(),
  _count: { orders: 2 },
  orders: [{ totalPrice: 50000 }, { totalPrice: 30000 }],
}

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/missing authorization token/i)
  })

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer invalid-token')
    expect(res.status).toBe(401)
  })

  it('returns 403 when token is for non-admin role', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/admin access required/i)
  })

  it('returns 200 with paginated user list for admin', async () => {
    mockDb.user.count.mockResolvedValueOnce(1)
    mockDb.user.findMany.mockResolvedValueOnce([mockUser])

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta).toHaveProperty('total')
    expect(res.body.meta).toHaveProperty('page')
    expect(res.body.meta).toHaveProperty('limit')
    expect(res.body.meta).toHaveProperty('totalPages')
  })

  it('returns users sorted by totalSpent descending', async () => {
    const users = [
      { ...mockUser, id: 1, orders: [{ totalPrice: 10000 }] },
      { ...mockUser, id: 2, orders: [{ totalPrice: 90000 }] },
    ]
    mockDb.user.findMany.mockResolvedValueOnce(users)

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    // User with id 2 (90000) should come first
    expect(res.body.data[0].totalSpent).toBeGreaterThan(res.body.data[1].totalSpent)
  })

  it('returns empty list when no users exist', async () => {
    mockDb.user.count.mockResolvedValueOnce(0)
    mockDb.user.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
    expect(res.body.meta.total).toBe(0)
  })

  it('respects pagination query params', async () => {
    const manyUsers = Array.from({ length: 5 }, (_, i) => ({
      ...mockUser,
      id: i + 1,
      orders: [],
    }))
    mockDb.user.findMany.mockResolvedValueOnce(manyUsers)

    const res = await request(app)
      .get('/api/users?page=2&limit=2')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.meta.page).toBe(2)
    expect(res.body.meta.limit).toBe(2)
  })

  it('does not include password in response', async () => {
    mockDb.user.findMany.mockResolvedValueOnce([{ ...mockUser, password: 'hashed' }])

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    res.body.data.forEach((u: Record<string, unknown>) => {
      expect(u).not.toHaveProperty('password')
    })
  })
})

describe('GET /api/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/users/1')
    expect(res.status).toBe(401)
  })

  it('returns 404 when user does not exist', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .get('/api/users/99999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 200 with user data when found', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 10,
      name: 'John Doe',
      email: 'john@example.com',
      roleId: 2,
      avatar: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const res = await request(app)
      .get('/api/users/10')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(10)
    expect(res.body.email).toBe('john@example.com')
    expect(res.body).not.toHaveProperty('password')
  })
})

describe('PATCH /api/users/:id/role', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/users/1/role')
      .send({ roleId: 1 })
    expect(res.status).toBe(401)
  })

  it('returns 400 when roleId is invalid', async () => {
    const res = await request(app)
      .patch('/api/users/1/role')
      .set('Authorization', authHeader)
      .send({ roleId: 99 })

    expect(res.status).toBe(400)
  })

  it('returns 200 with updated user on valid roleId', async () => {
    mockDb.user.update.mockResolvedValueOnce({
      id: 10,
      name: 'John Doe',
      email: 'john@example.com',
      roleId: 1,
    })

    const res = await request(app)
      .patch('/api/users/10/role')
      .set('Authorization', authHeader)
      .send({ roleId: 1 })

    expect(res.status).toBe(200)
    expect(res.body.roleId).toBe(1)
  })
})

describe('DELETE /api/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/users/1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin token', async () => {
    const res = await request(app)
      .delete('/api/users/1')
      .set('Authorization', `Bearer ${userToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with success message on deletion', async () => {
    mockDb.user.delete.mockResolvedValueOnce({ id: 10 })

    const res = await request(app)
      .delete('/api/users/10')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })
})
