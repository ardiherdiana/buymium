import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { mockDb } from '../setup'
import { makeUserToken, makeAdminToken } from '../helpers'

const userToken = makeUserToken(1)
const adminToken = makeAdminToken(99)

const mockStock = {
  id: 1,
  productId: 1,
  email: 'account@netflix.com',
  passwordEmail: 'emailpass',
  username: 'netflixuser',
  password: 'netflixpass',
  twoFactorCode: null,
  status: 'available',
  orderId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const bulkData = [
  { username: 'user1', password: 'pass1', email: 'u1@test.com' },
  { username: 'user2', password: 'pass2' },
]

describe('GET /api/stocks/product/:id', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/stocks/product/1')
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    const res = await request(app)
      .get('/api/stocks/product/1')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Akses ditolak')
  })

  it('returns 200 with stock list when admin', async () => {
    mockDb.stock.findMany.mockResolvedValue([mockStock])

    const res = await request(app)
      .get('/api/stocks/product/1')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].id).toBe(1)
  })

  it('returns 200 with empty array when no stocks', async () => {
    mockDb.stock.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/stocks/product/1')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('POST /api/stocks/bulk', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/stocks/bulk')
      .send({ productId: 1, data: bulkData })

    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    const res = await request(app)
      .post('/api/stocks/bulk')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: 1, data: bulkData })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Akses ditolak')
  })

  it('returns 400 when productId is missing', async () => {
    const res = await request(app)
      .post('/api/stocks/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ data: bulkData })

    expect(res.status).toBe(400)
  })

  it('returns 400 when data array is missing', async () => {
    const res = await request(app)
      .post('/api/stocks/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: 1 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when data array is empty', async () => {
    const res = await request(app)
      .post('/api/stocks/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: 1, data: [] })

    expect(res.status).toBe(400)
  })

  it('returns 201 with stock count on success', async () => {
    const createdStocks = bulkData.map((_, i) => ({ ...mockStock, id: i + 1 }))
    mockDb.$transaction.mockResolvedValue(createdStocks)
    mockDb.stock.count.mockResolvedValue(2)
    mockDb.product.update.mockResolvedValue({})

    const res = await request(app)
      .post('/api/stocks/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: 1, data: bulkData })

    expect(res.status).toBe(201)
    expect(res.body.count).toBe(2)
    expect(res.body.message).toContain('berhasil diunggah')
  })
})

describe('DELETE /api/stocks/:id (admin)', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).delete('/api/stocks/1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request(app)
      .delete('/api/stocks/1')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(403)
  })

  it('returns 200 on successful stock deletion', async () => {
    mockDb.stock.delete.mockResolvedValue(mockStock)
    mockDb.stock.count.mockResolvedValue(4)
    mockDb.product.update.mockResolvedValue({})

    const res = await request(app)
      .delete('/api/stocks/1')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Stok berhasil dihapus')
  })

  it('returns 404 when stock not found', async () => {
    mockDb.stock.delete.mockRejectedValue(new Error('Record not found'))

    const res = await request(app)
      .delete('/api/stocks/999')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Stok tidak ditemukan')
  })
})
