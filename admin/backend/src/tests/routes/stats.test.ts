import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken, makeUserToken } from '../helpers'

const mockDb = vi.mocked(db)

const authHeader = `Bearer ${makeAdminToken()}`
const userHeader = `Bearer ${makeUserToken()}`

describe('GET /api/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).get('/api/stats')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/missing authorization token/i)
  })

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', 'Bearer bad-token')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin token', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', userHeader)
    expect(res.status).toBe(403)
  })

  it('returns 200 with dashboard statistics structure', async () => {
    mockDb.product.count.mockResolvedValueOnce(10)
    mockDb.order.count
      .mockResolvedValueOnce(50)       // totalOrders
      .mockResolvedValueOnce(30)       // paidOrders
      .mockResolvedValueOnce(10)       // pendingOrders
    mockDb.order.aggregate.mockResolvedValueOnce({ _sum: { totalPrice: 1500000 } })
    mockDb.user.count.mockResolvedValueOnce(25)
    mockDb.order.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('totalProducts')
    expect(res.body).toHaveProperty('totalOrders')
    expect(res.body).toHaveProperty('paidOrders')
    expect(res.body).toHaveProperty('pendingOrders')
    expect(res.body).toHaveProperty('revenue')
    expect(res.body).toHaveProperty('totalUsers')
    expect(res.body).toHaveProperty('recentPaidOrders')
  })

  it('returns correct values from mocked db calls', async () => {
    mockDb.product.count.mockResolvedValueOnce(5)
    mockDb.order.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(5)
    mockDb.order.aggregate.mockResolvedValueOnce({ _sum: { totalPrice: 750000 } })
    mockDb.user.count.mockResolvedValueOnce(12)
    mockDb.order.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.totalProducts).toBe(5)
    expect(res.body.totalOrders).toBe(20)
    expect(res.body.paidOrders).toBe(15)
    expect(res.body.pendingOrders).toBe(5)
    expect(res.body.revenue).toBe(750000)
    expect(res.body.totalUsers).toBe(12)
  })

  it('returns 0 revenue when no paid orders exist', async () => {
    mockDb.product.count.mockResolvedValueOnce(0)
    mockDb.order.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    mockDb.order.aggregate.mockResolvedValueOnce({ _sum: { totalPrice: null } })
    mockDb.user.count.mockResolvedValueOnce(0)
    mockDb.order.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.revenue).toBe(0)
  })

  it('returns recentPaidOrders as array', async () => {
    const recentOrder = {
      id: 1,
      totalPrice: 50000,
      status: 'paid',
      createdAt: new Date().toISOString(),
      user: { id: 1, name: 'Test User', email: 'test@test.com' },
      product: { id: 1, title: 'Netflix Premium' },
    }
    mockDb.product.count.mockResolvedValueOnce(1)
    mockDb.order.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
    mockDb.order.aggregate.mockResolvedValueOnce({ _sum: { totalPrice: 50000 } })
    mockDb.user.count.mockResolvedValueOnce(1)
    mockDb.order.findMany.mockResolvedValueOnce([recentOrder])

    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.recentPaidOrders)).toBe(true)
    expect(res.body.recentPaidOrders).toHaveLength(1)
  })
})

describe('GET /api/stats/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/stats/orders')
    expect(res.status).toBe(401)
  })

  it('returns 200 with order status breakdown', async () => {
    mockDb.order.count
      .mockResolvedValueOnce(10) // paid
      .mockResolvedValueOnce(5)  // pending
      .mockResolvedValueOnce(2)  // failed
      .mockResolvedValueOnce(1)  // cancelled

    const res = await request(app)
      .get('/api/stats/orders')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('paid')
    expect(res.body).toHaveProperty('pending')
    expect(res.body).toHaveProperty('failed')
    expect(res.body).toHaveProperty('cancelled')
    expect(res.body).toHaveProperty('total')
    expect(res.body.paid).toBe(10)
    expect(res.body.total).toBe(18)
  })
})

describe('GET /api/stats/revenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/stats/revenue')
    expect(res.status).toBe(401)
  })

  it('returns 200 with total and monthly revenue', async () => {
    mockDb.order.aggregate.mockResolvedValueOnce({ _sum: { totalPrice: 2000000 } })
    mockDb.order.groupBy.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/stats/revenue')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('monthly')
    expect(res.body.total).toBe(2000000)
    expect(Array.isArray(res.body.monthly)).toBe(true)
  })
})
