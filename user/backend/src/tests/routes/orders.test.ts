import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { mockDb } from '../setup'
import { makeUserToken } from '../helpers'

const userToken = makeUserToken(1)

const mockProduct = {
  id: 1,
  title: 'Netflix Premium',
  description: 'Akun Netflix',
  inStock: 5,
  price: 50000,
  rating: 4.5,
  isVerified: true,
  sectionId: null,
  sourceId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockSource = { id: 1, isAccsmarket: false }

const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'user@test.com',
  roleId: 2,
  avatar: '',
}

const mockOrder = {
  id: 1,
  userId: 1,
  productId: 1,
  quantity: 1,
  totalPrice: 52000,
  status: 'pending',
  snapToken: 'snap-token',
  snapUrl: 'https://pay.url',
  midtransId: 'BUYMIUM-1-1234567890',
  paymentMethod: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  product: { id: 1, title: 'Netflix Premium', price: 50000, section: { title: 'Streaming' } },
}

describe('POST /api/orders', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ productId: 1, quantity: 1 })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Tidak diizinkan')
  })

  it('returns 400 when productId is missing', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 1 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when quantity is zero or negative', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: 1, quantity: 0 })

    expect(res.status).toBe(400)
  })

  it('returns 201 on successful order creation', async () => {
    mockDb.product.findUnique.mockResolvedValue(mockProduct)
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockDb.order.create.mockResolvedValue({ id: 1, userId: 1, productId: 1, quantity: 1, totalPrice: 52000, status: 'pending', groupId: 'BUYMIUM-SO-1-123' })
    mockDb.source.findUnique.mockResolvedValue(mockSource)
    mockDb.account.count.mockResolvedValue(5)
    mockDb.account.findMany.mockResolvedValue([{ id: 1 }])
    mockDb.account.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: 1, quantity: 1 })

    expect(res.status).toBe(201)
    expect(res.body.orderId).toBe(1)
    expect(res.body.groupId).toBeDefined()
  })

  it('returns 404 when product does not exist', async () => {
    mockDb.product.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: 999, quantity: 1 })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Produk tidak ditemukan')
  })

  it('returns 400 when stock is insufficient', async () => {
    mockDb.product.findUnique.mockResolvedValue(mockProduct)
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockDb.source.findUnique.mockResolvedValue(mockSource)
    mockDb.account.count.mockResolvedValue(1)

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: 1, quantity: 5 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Stok tidak mencukupi')
  })
})

describe('GET /api/orders', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/orders')
    expect(res.status).toBe(401)
  })

  it('returns 200 with user orders when authenticated', async () => {
    // First findMany: expired check (returns empty so no updateMany needed)
    // Second findMany: actual order list
    mockDb.order.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockOrder])

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].id).toBe(1)
  })

  it('returns 200 with empty array when user has no orders', async () => {
    mockDb.order.findMany
      .mockResolvedValueOnce([])  // expired check
      .mockResolvedValueOnce([])  // actual list

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('GET /api/orders/:id', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/orders/1')
    expect(res.status).toBe(401)
  })

  it('returns 404 when order does not belong to user', async () => {
    mockDb.order.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/orders/999')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Pesanan tidak ditemukan')
  })

  it('returns 200 with order detail when found', async () => {
    const orderWithProduct = {
      ...mockOrder,
      product: { id: 1, title: 'Netflix', section: null },
      midtransId: null,
    }
    mockDb.order.findFirst.mockResolvedValue(orderWithProduct)

    const res = await request(app)
      .get('/api/orders/1')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.relatedOrders).toEqual([])
  })

  it('returns cart related orders when groupId starts with BUYMIUM-CART-', async () => {
    const cartOrder = {
      ...mockOrder,
      groupId: 'BUYMIUM-CART-1-1234567890',
      product: { id: 1, title: 'Netflix', section: null },
    }
    const siblingOrders = [
      { ...cartOrder, id: 1 },
      { ...cartOrder, id: 2, productId: 2 },
    ]
    mockDb.order.findFirst.mockResolvedValue(cartOrder)
    mockDb.order.findMany.mockResolvedValue(siblingOrders)

    const res = await request(app)
      .get('/api/orders/1')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(200)
    expect(res.body.relatedOrders).toHaveLength(2)
  })
})

describe('POST /api/orders/notification (removed - manual payment)', () => {
  it('returns 404 because Midtrans webhook route no longer exists', async () => {
    const res = await request(app)
      .post('/api/orders/notification')
      .send({ order_id: 'BUYMIUM-1-123' })

    expect(res.status).toBe(404)
  })
})

describe('POST /api/orders/cart', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/orders/cart')
      .send({ items: [{ productId: 1, quantity: 1 }] })

    expect(res.status).toBe(401)
  })

  it('returns 400 when items is empty', async () => {
    const res = await request(app)
      .post('/api/orders/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [] })

    expect(res.status).toBe(400)
  })

  it('returns 400 when items is missing', async () => {
    const res = await request(app)
      .post('/api/orders/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 201 on successful cart checkout', async () => {
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockDb.product.findUnique.mockResolvedValue(mockProduct)
    mockDb.order.create.mockResolvedValue({ id: 1, userId: 1, productId: 1, quantity: 1, totalPrice: 52000, status: 'pending', groupId: 'BUYMIUM-CART-1-123' })
    mockDb.source.findUnique.mockResolvedValue(mockSource)
    mockDb.account.count.mockResolvedValue(5)
    mockDb.account.findMany.mockResolvedValue([{ id: 1 }])
    mockDb.account.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .post('/api/orders/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ productId: 1, quantity: 1 }] })

    expect(res.status).toBe(201)
    expect(res.body.firstOrderId).toBeDefined()
    expect(Array.isArray(res.body.orderIds)).toBe(true)
    expect(res.body.groupId).toBeDefined()
  })

  it('returns 404 when product in cart not found', async () => {
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockDb.product.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/orders/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ productId: 999, quantity: 1 }] })

    expect(res.status).toBe(404)
  })

  it('returns 400 when cart product has insufficient stock', async () => {
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockDb.product.findUnique.mockResolvedValue(mockProduct)
    mockDb.source.findUnique.mockResolvedValue(mockSource)
    mockDb.account.count.mockResolvedValue(1)

    const res = await request(app)
      .post('/api/orders/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ productId: 1, quantity: 5 }] })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('tidak mencukupi')
  })
})

describe('GET /api/orders/:id/sync (removed - manual payment)', () => {
  it('returns 404 because Midtrans sync route no longer exists', async () => {
    const res = await request(app)
      .get('/api/orders/1/sync')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(404)
  })
})

describe('GET /api/orders/:id/download', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/orders/1/download')
    expect(res.status).toBe(401)
  })

  it('returns 404 when order not found or not paid', async () => {
    mockDb.order.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/orders/1/download')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Data tidak ditemukan atau pesanan belum dibayar')
  })

  it('returns 404 when order is paid but has no inventory refs', async () => {
    mockDb.order.findFirst.mockResolvedValue({
      ...mockOrder,
      status: 'paid',
      inventoryRefs: null,
      product: mockProduct,
    })

    const res = await request(app)
      .get('/api/orders/1/download')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Gagal mengambil data akun. Silakan hubungi admin.')
  })

  it('returns text file download when order is paid with inventory refs', async () => {
    const paidOrder = {
      ...mockOrder,
      status: 'paid',
      groupId: 'BUYMIUM-1-123',
      product: { ...mockProduct, title: 'Netflix Premium' },
      inventoryRefs: JSON.stringify([{ type: 'account', id: 1 }]),
    }
    mockDb.order.findFirst.mockResolvedValue(paidOrder)
    mockDb.account.findMany.mockResolvedValue([
      { id: 1, email: 'account@netflix.com', username: 'netflixuser', password: 'secret' },
    ])
    mockDb.accsmarket.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/orders/1/download')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(200)
    expect(res.header['content-type']).toContain('text/plain')
    expect(res.header['content-disposition']).toContain('attachment')
    expect(res.text).toContain('BUYMIUM-1-123')
    expect(res.text).toContain('Netflix Premium')
    expect(res.text).toContain('netflixuser')
  })
})
