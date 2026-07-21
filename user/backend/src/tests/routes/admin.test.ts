import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { mockDb } from '../setup'
import { makeUserToken, makeAdminToken } from '../helpers'

const userToken = makeUserToken(1)
const adminToken = makeAdminToken(99)

const mockOrder = {
  id: 1,
  userId: 1,
  productId: 1,
  quantity: 1,
  totalPrice: 52000,
  status: 'paid',
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 1, name: 'Test User', email: 'user@test.com' },
  product: { id: 1, title: 'Netflix Premium', section: { title: 'Streaming' } },
}

const mockUser = {
  id: 2,
  name: 'Regular User',
  email: 'regular@test.com',
  roleId: 2,
  avatar: '',
  createdAt: new Date(),
}

describe('GET /api/admin/stats', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/admin/stats')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Akses ditolak')
  })

  it('returns 200 with stats for admin', async () => {
    mockDb.product.count.mockResolvedValue(10)
    mockDb.order.count
      .mockResolvedValueOnce(50)  // totalOrders
      .mockResolvedValueOnce(30)  // paidOrders
      .mockResolvedValueOnce(10)  // pendingOrders
    mockDb.order.aggregate.mockResolvedValue({ _sum: { totalPrice: 1500000 } })
    mockDb.user.count.mockResolvedValue(25)

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.totalProducts).toBe(10)
    expect(res.body.totalOrders).toBe(50)
    expect(res.body.paidOrders).toBe(30)
    expect(res.body.pendingOrders).toBe(10)
    expect(res.body.revenue).toBe(1500000)
    expect(res.body.totalUsers).toBe(25)
  })

  it('returns 0 revenue when no paid orders', async () => {
    mockDb.product.count.mockResolvedValue(0)
    mockDb.order.count.mockResolvedValue(0)
    mockDb.order.aggregate.mockResolvedValue({ _sum: { totalPrice: null } })
    mockDb.user.count.mockResolvedValue(0)

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.revenue).toBe(0)
  })
})

describe('GET /api/admin/orders', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/admin/orders')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(403)
  })

  it('returns 200 with paginated orders for admin', async () => {
    mockDb.order.count.mockResolvedValue(2)
    mockDb.order.findMany.mockResolvedValue([mockOrder])

    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.meta).toBeDefined()
    expect(res.body.meta.total).toBe(2)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('filters orders by status', async () => {
    mockDb.order.count.mockResolvedValue(1)
    mockDb.order.findMany.mockResolvedValue([mockOrder])

    const res = await request(app)
      .get('/api/admin/orders?status=paid')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.meta.total).toBe(1)
  })

  it('supports pagination', async () => {
    mockDb.order.count.mockResolvedValue(100)
    mockDb.order.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/admin/orders?page=2&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.meta.page).toBe(2)
    expect(res.body.meta.limit).toBe(10)
    expect(res.body.meta.totalPages).toBe(10)
  })
})

describe('GET /api/admin/orders/:id', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/admin/orders/1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/admin/orders/1')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(403)
  })

  it('returns 200 with order detail for admin', async () => {
    mockDb.order.findUnique.mockResolvedValue(mockOrder)

    const res = await request(app)
      .get('/api/admin/orders/1')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.status).toBe('paid')
  })

  it('returns 404 when order not found', async () => {
    mockDb.order.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/admin/orders/999')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Pesanan tidak ditemukan')
  })
})

describe('GET /api/admin/users', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/admin/users')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(403)
  })

  it('returns 200 with user list for admin', async () => {
    mockDb.user.count.mockResolvedValue(5)
    mockDb.user.findMany.mockResolvedValue([mockUser])

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.meta.total).toBe(5)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('supports search query', async () => {
    mockDb.user.count.mockResolvedValue(1)
    mockDb.user.findMany.mockResolvedValue([mockUser])

    const res = await request(app)
      .get('/api/admin/users?search=regular')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
  })
})

describe('PATCH /api/admin/users/:id/role', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app)
      .patch('/api/admin/users/1/role')
      .send({ roleId: 2 })

    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .patch('/api/admin/users/1/role')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ roleId: 2 })

    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid roleId', async () => {
    const res = await request(app)
      .patch('/api/admin/users/1/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: 99 })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Role ID tidak valid')
  })

  it('returns 200 on successful role update', async () => {
    mockDb.user.update.mockResolvedValue({ ...mockUser, roleId: 1 })

    const res = await request(app)
      .patch('/api/admin/users/2/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: 1 })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Role berhasil diperbarui')
  })

  it('returns 404 when user not found', async () => {
    mockDb.user.update.mockRejectedValue(new Error('Record not found'))

    const res = await request(app)
      .patch('/api/admin/users/999/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: 2 })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('User tidak ditemukan')
  })
})

describe('DELETE /api/admin/users/:id', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).delete('/api/admin/users/1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .delete('/api/admin/users/1')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(403)
  })

  it('returns 200 on successful user deletion', async () => {
    mockDb.user.delete.mockResolvedValue(mockUser)

    const res = await request(app)
      .delete('/api/admin/users/2')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('User berhasil dihapus')
  })

  it('returns 404 when user not found', async () => {
    mockDb.user.delete.mockRejectedValue(new Error('Record not found'))

    const res = await request(app)
      .delete('/api/admin/users/999')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('User tidak ditemukan')
  })
})
