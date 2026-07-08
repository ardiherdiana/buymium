import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken } from '../helpers'

const mockDb = vi.mocked(db)
const authHeader = `Bearer ${makeAdminToken()}`

const mockOrder = {
  id: 1,
  status: 'pending',
  totalPrice: 50000,
  createdAt: new Date().toISOString(),
  user: { id: 10, name: 'John Doe', email: 'john@test.com' },
  product: { id: 1, title: 'Netflix', section: { title: 'Streaming' } },
}

describe('GET /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/orders')
    expect(res.status).toBe(401)
  })

  it('returns 200 with paginated orders list', async () => {
    mockDb.order.count.mockResolvedValueOnce(3)
    mockDb.order.findMany.mockResolvedValueOnce([
      mockOrder,
      { ...mockOrder, id: 2, status: 'paid' },
      { ...mockOrder, id: 3, status: 'failed' },
    ])

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toHaveLength(3)
    expect(res.body.meta.total).toBe(3)
    expect(res.body.meta.page).toBe(1)
  })

  it('returns 200 with empty list when no orders', async () => {
    mockDb.order.count.mockResolvedValueOnce(0)
    mockDb.order.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
    expect(res.body.meta.total).toBe(0)
  })

  it('filters by status when provided', async () => {
    mockDb.order.count.mockResolvedValueOnce(1)
    mockDb.order.findMany.mockResolvedValueOnce([{ ...mockOrder, status: 'paid' }])

    const res = await request(app)
      .get('/api/orders?status=paid')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    // Verify where clause included status filter
    expect(mockDb.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'paid' }),
      })
    )
  })

  it('returns correct pagination metadata', async () => {
    mockDb.order.count.mockResolvedValueOnce(45)
    mockDb.order.findMany.mockResolvedValueOnce([mockOrder])

    const res = await request(app)
      .get('/api/orders?page=2&limit=10')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.meta.page).toBe(2)
    expect(res.body.meta.limit).toBe(10)
    expect(res.body.meta.totalPages).toBe(5)
    expect(mockDb.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    )
  })
})

describe('GET /api/orders/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with order detail', async () => {
    const detailedOrder = {
      ...mockOrder,
      inventoryRefs: null,
      product: { ...mockOrder.product, section: { title: 'Streaming' } },
    }
    mockDb.order.findUnique.mockResolvedValueOnce(detailedOrder)

    const res = await request(app)
      .get('/api/orders/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body).toHaveProperty('inventoryItems')
  })

  it('returns 404 when order does not exist', async () => {
    mockDb.order.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .get('/api/orders/99999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })
})

describe('PATCH /api/orders/:id/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .send({ status: 'paid' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid status value', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .set('Authorization', authHeader)
      .send({ status: 'refunded' }) // not a valid status

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid status/i)
  })

  it('returns 200 when updating to a valid status', async () => {
    const updatedOrder = { ...mockOrder, status: 'paid' }
    mockDb.order.update.mockResolvedValueOnce(updatedOrder)

    const res = await request(app)
      .patch('/api/orders/1/status')
      .set('Authorization', authHeader)
      .send({ status: 'paid' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('paid')
  })

  it.each(['pending', 'paid', 'failed', 'cancelled'])(
    'accepts valid status "%s"',
    async (status) => {
      mockDb.order.update.mockResolvedValueOnce({ ...mockOrder, status })

      const res = await request(app)
        .patch('/api/orders/1/status')
        .set('Authorization', authHeader)
        .send({ status })

      expect(res.status).toBe(200)
    }
  )
})

describe('DELETE /api/orders/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/orders/1')
    expect(res.status).toBe(401)
  })

  it('releases reserved inventory before deleting order', async () => {
    mockDb.order.findUnique.mockResolvedValueOnce(mockOrder)
    mockDb.order.delete.mockResolvedValueOnce(mockOrder)

    const res = await request(app)
      .delete('/api/orders/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted successfully/i)
    expect(mockDb.account.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reservedOrderId: 1 } })
    )
    expect(mockDb.accsmarket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reservedOrderId: 1 } })
    )
    expect(mockDb.order.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    )
  })
})
