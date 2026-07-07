import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken } from '../helpers'

const mockDb = vi.mocked(db)

const adminToken = makeAdminToken()
const authHeader = `Bearer ${adminToken}`

const mockProduct = {
  id: 1,
  title: 'Premium Netflix Account',
  description: '1 month Netflix subscription',
  price: 50000,
  inStock: 10,
  rating: 4.5,
  isVerified: true,
  tags: '["streaming","entertainment"]',
  sectionId: 'section-1',
  createdAt: new Date().toISOString(),
  section: { title: 'Streaming Services' },
}

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).get('/api/products')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/missing authorization token/i)
  })

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', 'Bearer invalid-token')
    expect(res.status).toBe(401)
  })

  it('returns 200 with paginated product list', async () => {
    mockDb.product.count.mockResolvedValueOnce(2)
    mockDb.product.findMany.mockResolvedValueOnce([
      mockProduct,
      { ...mockProduct, id: 2, title: 'Spotify Premium' },
    ])

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.meta.total).toBe(2)
    expect(res.body.meta.page).toBe(1)
  })

  it('returns empty array when no products exist', async () => {
    mockDb.product.count.mockResolvedValueOnce(0)
    mockDb.product.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
    expect(res.body.meta.total).toBe(0)
    expect(res.body.meta.totalPages).toBe(0)
  })

  it('respects pagination query params', async () => {
    mockDb.product.count.mockResolvedValueOnce(50)
    mockDb.product.findMany.mockResolvedValueOnce([mockProduct])

    const res = await request(app)
      .get('/api/products?page=3&limit=10')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.meta.page).toBe(3)
    expect(res.body.meta.limit).toBe(10)
    // Verify findMany was called with correct skip
    expect(mockDb.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    )
  })
})

describe('GET /api/products/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with product data', async () => {
    mockDb.product.findUnique.mockResolvedValueOnce({
      ...mockProduct,
      stocks: [],
      section: { id: 'section-1', title: 'Streaming Services', subtitle: '', order: 0 },
    })

    const res = await request(app)
      .get('/api/products/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.title).toBe('Premium Netflix Account')
  })

  it('returns 404 when product does not exist', async () => {
    mockDb.product.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .get('/api/products/99999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })
})

describe('POST /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ title: 'Test', description: 'Desc', price: 1000 })
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', authHeader)
      .send({ title: 'Test' }) // missing description and price

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', authHeader)
      .send({ description: 'desc', price: 1000 })

    expect(res.status).toBe(400)
  })

  it('returns 201 with created product on valid data', async () => {
    const createdProduct = {
      ...mockProduct,
      id: 10,
      title: 'New Product',
      description: 'A new product',
      price: 75000,
      inStock: 0,
      sectionId: null,
    }
    mockDb.product.create.mockResolvedValueOnce(createdProduct)

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', authHeader)
      .send({
        title: 'New Product',
        description: 'A new product',
        price: 75000,
        tags: ['streaming'],
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe(10)
    expect(res.body.title).toBe('New Product')
    // Verify db.product.create was called with inStock: 0
    expect(mockDb.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ inStock: 0, price: 75000 }),
      })
    )
  })
})

describe('PATCH /api/products/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/products/1')
      .send({ title: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('returns 200 with updated product', async () => {
    const updatedProduct = { ...mockProduct, title: 'Updated Title', price: 60000 }
    mockDb.product.update.mockResolvedValueOnce(updatedProduct)

    const res = await request(app)
      .patch('/api/products/1')
      .set('Authorization', authHeader)
      .send({ title: 'Updated Title', price: 60000 })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated Title')
    expect(res.body.price).toBe(60000)
  })

  it('only updates the provided fields', async () => {
    mockDb.product.update.mockResolvedValueOnce({ ...mockProduct, inStock: 25 })

    const res = await request(app)
      .patch('/api/products/1')
      .set('Authorization', authHeader)
      .send({ inStock: 25 })

    expect(res.status).toBe(200)
    // Verify update was called with only inStock in data
    expect(mockDb.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ inStock: 25 }),
        where: { id: 1 },
      })
    )
  })
})

describe('PUT /api/products/:id/variants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put('/api/products/1/variants')
      .send({ variants: [] })
    expect(res.status).toBe(401)
  })

  it('replaces variants, sets variantLabel and returns the new list', async () => {
    mockDb.$transaction.mockResolvedValueOnce([])
    mockDb.productVariant.findMany.mockResolvedValueOnce([
      { id: 1, productId: 1, name: '1.000+ Followers', price: 25000, order: 0, isActive: true },
      { id: 2, productId: 1, name: '2.000+ Followers', price: 65000, order: 1, isActive: true },
    ])

    const res = await request(app)
      .put('/api/products/1/variants')
      .set('Authorization', authHeader)
      .send({
        variantLabel: 'Jumlah',
        variants: [
          { name: '1.000+ Followers', price: 25000 },
          { name: '2.000+ Followers', price: 65000 },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(mockDb.$transaction).toHaveBeenCalled()
    // First transaction op updates the product's variantLabel
    const txOps = mockDb.$transaction.mock.calls[0][0]
    expect(txOps).toHaveLength(4) // product.update + deleteMany + 2 creates
  })

  it('clears variantLabel and deletes all variants when the list is empty (toggle off)', async () => {
    mockDb.$transaction.mockResolvedValueOnce([])
    mockDb.productVariant.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .put('/api/products/1/variants')
      .set('Authorization', authHeader)
      .send({ variantLabel: 'Jumlah', variants: [] })

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
    const txOps = mockDb.$transaction.mock.calls[0][0]
    expect(txOps).toHaveLength(2) // product.update (clears label) + deleteMany, no creates
  })

  it('returns 400 when a variant is missing a name', async () => {
    const res = await request(app)
      .put('/api/products/1/variants')
      .set('Authorization', authHeader)
      .send({ variants: [{ price: 1000 }] })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/products/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/products/1')
    expect(res.status).toBe(401)
  })

  it('returns 200 on successful deletion', async () => {
    mockDb.product.delete.mockResolvedValueOnce(mockProduct)

    const res = await request(app)
      .delete('/api/products/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })
})
