import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { mockDb } from '../setup'
import { makeUserToken, makeAdminToken } from '../helpers'

const userToken = makeUserToken(1)
const adminToken = makeAdminToken(99)

const mockProduct = {
  id: 1,
  title: 'Netflix Premium',
  description: 'Akun Netflix 1 bulan',
  inStock: 10,
  price: 50000,
  rating: 4.5,
  isVerified: true,
  tags: '["streaming","entertainment"]',
  sectionId: 'streaming',
  createdAt: new Date(),
  updatedAt: new Date(),
  section: { id: 'streaming', title: 'Streaming', subtitle: '', order: 1 },
}

describe('GET /api/products', () => {
  it('returns 200 with paginated products', async () => {
    mockDb.product.count.mockResolvedValue(3)
    mockDb.product.findMany.mockResolvedValue([mockProduct])

    const res = await request(app).get('/api/products')

    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.meta).toBeDefined()
    expect(res.body.meta.total).toBe(3)
    expect(res.body.meta.page).toBe(1)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('returns 200 with parsed tags as array', async () => {
    mockDb.product.count.mockResolvedValue(1)
    mockDb.product.findMany.mockResolvedValue([mockProduct])

    const res = await request(app).get('/api/products')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data[0].tags)).toBe(true)
    expect(res.body.data[0].tags).toEqual(['streaming', 'entertainment'])
  })

  it('supports pagination query params', async () => {
    mockDb.product.count.mockResolvedValue(50)
    mockDb.product.findMany.mockResolvedValue([])

    const res = await request(app).get('/api/products?page=2&limit=10')

    expect(res.status).toBe(200)
    expect(res.body.meta.page).toBe(2)
    expect(res.body.meta.limit).toBe(10)
    expect(res.body.meta.totalPages).toBe(5)
  })

  it('returns empty data when no products exist', async () => {
    mockDb.product.count.mockResolvedValue(0)
    mockDb.product.findMany.mockResolvedValue([])

    const res = await request(app).get('/api/products')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.total).toBe(0)
  })
})

describe('GET /api/products/:id', () => {
  it('returns 200 with product when found', async () => {
    mockDb.product.findUnique.mockResolvedValue(mockProduct)

    const res = await request(app).get('/api/products/1')

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.title).toBe('Netflix Premium')
    expect(Array.isArray(res.body.tags)).toBe(true)
  })

  it('returns 404 when product not found', async () => {
    mockDb.product.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/products/999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Produk tidak ditemukan')
  })

  it('returns 400 when id is not a number', async () => {
    const res = await request(app).get('/api/products/abc')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ID tidak valid')
  })
})

describe('GET /api/products/stats', () => {
  it('returns 200 with product stats', async () => {
    mockDb.product.count.mockResolvedValue(5)
    mockDb.product.aggregate
      .mockResolvedValueOnce({ _sum: { inStock: 50 } })
      .mockResolvedValueOnce({ _avg: { rating: 4.2 } })

    const res = await request(app).get('/api/products/stats')

    expect(res.status).toBe(200)
    expect(res.body.totalListings).toBe(5)
    expect(res.body.totalStock).toBe(50)
    expect(res.body.avgRating).toBe(4.2)
  })

  it('returns 0 totals when no products', async () => {
    mockDb.product.count.mockResolvedValue(0)
    mockDb.product.aggregate
      .mockResolvedValueOnce({ _sum: { inStock: null } })
      .mockResolvedValueOnce({ _avg: { rating: null } })

    const res = await request(app).get('/api/products/stats')

    expect(res.status).toBe(200)
    expect(res.body.totalStock).toBe(0)
    expect(res.body.avgRating).toBe(0)
  })
})

describe('POST /api/products (admin)', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ title: 'Test', description: 'Desc' })

    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Test', description: 'Desc' })

    expect(res.status).toBe(403)
  })

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'No title' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('title dan description wajib diisi')
  })

  it('returns 201 with created product for admin', async () => {
    mockDb.product.create.mockResolvedValue({
      ...mockProduct,
      id: 5,
      title: 'New Product',
    })

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'New Product', description: 'A new product', price: 25000, inStock: 10 })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('New Product')
  })
})

describe('PUT /api/products/:id (admin)', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app)
      .put('/api/products/1')
      .send({ title: 'Updated' })

    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .put('/api/products/1')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Updated' })

    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid id', async () => {
    const res = await request(app)
      .put('/api/products/abc')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ID tidak valid')
  })

  it('returns 200 with updated product for admin', async () => {
    mockDb.product.update.mockResolvedValue({ ...mockProduct, title: 'Updated Title' })

    const res = await request(app)
      .put('/api/products/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated Title')
  })
})

describe('DELETE /api/products/:id (admin)', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).delete('/api/products/1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .delete('/api/products/1')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid id', async () => {
    const res = await request(app)
      .delete('/api/products/abc')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ID tidak valid')
  })

  it('returns 200 on successful deletion', async () => {
    mockDb.product.delete.mockResolvedValue(mockProduct)

    const res = await request(app)
      .delete('/api/products/1')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Produk dihapus')
  })
})
