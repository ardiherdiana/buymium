import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken } from '../helpers'

const mockDb = vi.mocked(db)
const authHeader = `Bearer ${makeAdminToken()}`

const mockStock = {
  id: 1,
  productId: 1,
  username: 'testuser',
  password: 'testpass',
  email: 'test@example.com',
  passwordEmail: null,
  twoFactorCode: null,
  status: 'available',
  createdAt: new Date().toISOString(),
  orderId: null,
  product: { id: 1, title: 'Netflix Account' },
}

describe('GET /api/stocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/stocks')
    expect(res.status).toBe(401)
  })

  it('returns 200 with paginated stock list', async () => {
    mockDb.stock.count.mockResolvedValueOnce(5)
    mockDb.stock.findMany.mockResolvedValueOnce([
      mockStock,
      { ...mockStock, id: 2, username: 'user2' },
    ])

    const res = await request(app)
      .get('/api/stocks')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta.total).toBe(5)
  })

  it('filters by status=available', async () => {
    mockDb.stock.count.mockResolvedValueOnce(3)
    mockDb.stock.findMany.mockResolvedValueOnce([mockStock])

    const res = await request(app)
      .get('/api/stocks?status=available')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(mockDb.stock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'available' }),
      })
    )
  })

  it('ignores unknown status filter values', async () => {
    mockDb.stock.count.mockResolvedValueOnce(5)
    mockDb.stock.findMany.mockResolvedValueOnce([mockStock])

    const res = await request(app)
      .get('/api/stocks?status=unknown_status')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    // Should not include the invalid status in where clause
    expect(mockDb.stock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ status: 'unknown_status' }),
      })
    )
  })
})

describe('GET /api/stocks/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with stock detail including product and order', async () => {
    mockDb.stock.findUnique.mockResolvedValueOnce({
      ...mockStock,
      product: { id: 1, title: 'Netflix' },
      order: null,
    })

    const res = await request(app)
      .get('/api/stocks/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.username).toBe('testuser')
  })

  it('returns 404 when stock not found', async () => {
    mockDb.stock.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .get('/api/stocks/99999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })
})

describe('POST /api/stocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/stocks')
      .send({ productId: 1, username: 'u', password: 'p' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/stocks')
      .set('Authorization', authHeader)
      .send({ username: 'u', password: 'p' }) // missing productId

    expect(res.status).toBe(400)
  })

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/api/stocks')
      .set('Authorization', authHeader)
      .send({ productId: 1, password: 'p' })

    expect(res.status).toBe(400)
  })

  it('returns 201 with created stock', async () => {
    mockDb.stock.create.mockResolvedValueOnce({
      ...mockStock,
      id: 20,
      email: 'new@test.com',
    })

    const res = await request(app)
      .post('/api/stocks')
      .set('Authorization', authHeader)
      .send({
        productId: 1,
        username: 'newuser',
        password: 'newpass',
        email: 'new@test.com',
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe(20)
  })

  it('assigns the stock to a price variant (opsi) when variantId is provided', async () => {
    mockDb.stock.create.mockResolvedValueOnce({ ...mockStock, id: 21, variantId: 5 })

    const res = await request(app)
      .post('/api/stocks')
      .set('Authorization', authHeader)
      .send({
        productId: 1,
        variantId: 5,
        username: 'newuser',
        password: 'newpass',
      })

    expect(res.status).toBe(201)
    expect(mockDb.stock.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ variantId: 5 }) })
    )
  })
})

describe('POST /api/stocks/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when productId is missing', async () => {
    const res = await request(app)
      .post('/api/stocks/bulk')
      .set('Authorization', authHeader)
      .send({ data: [{ username: 'u', password: 'p' }] })

    expect(res.status).toBe(400)
  })

  it('returns 400 when data array is empty', async () => {
    const res = await request(app)
      .post('/api/stocks/bulk')
      .set('Authorization', authHeader)
      .send({ productId: 1, data: [] })

    expect(res.status).toBe(400)
  })

  it('returns 201 with count of created stocks', async () => {
    const bulkData = [
      { username: 'user1', password: 'pass1' },
      { username: 'user2', password: 'pass2' },
    ]
    mockDb.$transaction.mockResolvedValueOnce([
      { ...mockStock, id: 1 },
      { ...mockStock, id: 2, username: 'user2' },
    ])
    mockDb.stock.count.mockResolvedValueOnce(2)
    mockDb.product.update.mockResolvedValueOnce({ id: 1, inStock: 2 })

    const res = await request(app)
      .post('/api/stocks/bulk')
      .set('Authorization', authHeader)
      .send({ productId: 1, data: bulkData })

    expect(res.status).toBe(201)
    expect(res.body.count).toBe(2)
    expect(res.body.message).toContain('2')
  })
})

describe('PATCH /api/stocks/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with updated stock', async () => {
    mockDb.stock.update.mockResolvedValueOnce({ ...mockStock, status: 'sold' })

    const res = await request(app)
      .patch('/api/stocks/1')
      .set('Authorization', authHeader)
      .send({ status: 'sold' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('sold')
  })

  it('ignores invalid status values in update', async () => {
    mockDb.stock.update.mockResolvedValueOnce(mockStock)

    await request(app)
      .patch('/api/stocks/1')
      .set('Authorization', authHeader)
      .send({ status: 'hacked' })

    // The invalid status should not be passed to the update data
    expect(mockDb.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ status: 'hacked' }),
      })
    )
  })
})

describe('DELETE /api/stocks/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 on successful deletion', async () => {
    mockDb.stock.delete.mockResolvedValueOnce(mockStock)

    const res = await request(app)
      .delete('/api/stocks/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })
})
