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
    // Orders are grouped by groupId (a cart checkout shares one groupId across
    // several rows) before pagination is applied, so findMany returns every
    // matching row up front and paging happens in-memory over the groups.
    mockDb.order.findMany.mockResolvedValueOnce(
      Array.from({ length: 45 }, (_, i) => ({ ...mockOrder, id: i + 1 }))
    )

    const res = await request(app)
      .get('/api/orders?page=2&limit=10')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.meta.page).toBe(2)
    expect(res.body.meta.limit).toBe(10)
    expect(res.body.meta.totalPages).toBe(5)
    expect(res.body.data).toHaveLength(10)
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
    mockDb.account.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/orders/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body).toHaveProperty('inventoryItems')
  })

  it('splits a multi-variant cart group into per-order subtotal/fee/variantLabel', async () => {
    const productA = { id: 1, title: 'Akun IG', sourceSheetName: 'Buymium' }
    const orderRow = (id: number, totalPrice: number) => ({
      id, userId: 10, productId: 1, quantity: 1, totalPrice, status: 'awaiting_confirmation',
      groupId: 'BUYMIUM-CART-10-123', inventoryRefs: null, createdAt: new Date(),
      product: productA,
    })
    const order1 = orderRow(19, 90000)
    const order2 = orderRow(20, 140000)

    mockDb.order.findUnique.mockResolvedValueOnce({ ...order1, user: mockOrder.user, bankAccount: null })
    mockDb.order.findMany.mockResolvedValueOnce([order1, order2])
    mockDb.account.findMany
      .mockResolvedValueOnce([{ id: 100, targetFollowers: 1000 }])
      .mockResolvedValueOnce([{ id: 101, targetFollowers: 2000 }])
    ;(mockDb.productVariant as unknown as { findFirst: ReturnType<typeof vi.fn> }).findFirst = vi.fn()
      .mockResolvedValueOnce({ name: '1.000+ Followers' })
      .mockResolvedValueOnce({ name: '2.000+ Followers' })

    const res = await request(app).get('/api/orders/19').set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.subtotal).toBe(90000)
    expect(res.body.variantLabel).toBe('1.000+ Followers')
    expect(res.body.relatedOrders).toEqual([
      expect.objectContaining({ id: 19, subtotal: 90000, variantLabel: '1.000+ Followers' }),
      expect.objectContaining({ id: 20, subtotal: 140000, variantLabel: '2.000+ Followers' }),
    ])
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
    expect(mockDb.order.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    )
  })
})
