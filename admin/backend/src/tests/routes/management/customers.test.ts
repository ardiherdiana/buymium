import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockedObject } from 'vitest'
import request from 'supertest'
import app from '../../../app'
import { makeAdminToken } from '../../helpers'
import { PrismaClient } from '@prisma/client'

// customers.ts and CustomersController use `new PrismaClient()`.
// The mock in setup.ts intercepts all PrismaClient construction.

const authHeader = `Bearer ${makeAdminToken()}`

const mockCustomer = {
  id: 1,
  usernameSh: 'shopee_buyer',
  nomorHp: '081234567890',
  sourceId: 1,
  createdBy: 1,
  createdAt: new Date().toISOString(),
  creator: { id: 1, name: 'Admin' },
  sourceRel: { id: 1, name: 'Source A' },
}

describe('GET /api/management/customers', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 with customers and pagination', async () => {
    prismaInstance.customer.findMany
      .mockResolvedValueOnce([{ id: 1 }])  // allIds
      .mockResolvedValueOnce([mockCustomer]) // full fetch

    prismaInstance.sale.groupBy.mockResolvedValueOnce([
      { customerId: 1, _sum: { totalProfit: 50000 } },
    ])

    prismaInstance.source.findMany.mockResolvedValueOnce([{ id: 1, name: 'Source A' }])

    const res = await request(app)
      .get('/api/management/customers')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('customers')
    expect(res.body).toHaveProperty('pagination')
    expect(res.body).toHaveProperty('sources')
    expect(res.body).toHaveProperty('filters')
  })

  it('returns empty list when no customers exist', async () => {
    prismaInstance.customer.findMany.mockResolvedValue([])
    prismaInstance.sale.groupBy.mockResolvedValue([])
    prismaInstance.source.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/management/customers')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.customers).toHaveLength(0)
    expect(res.body.pagination.total).toBe(0)
  })

  it('includes total_profit per customer', async () => {
    prismaInstance.customer.findMany
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([mockCustomer])
    prismaInstance.sale.groupBy.mockResolvedValueOnce([
      { customerId: 1, _sum: { totalProfit: 120000 } },
    ])
    prismaInstance.source.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/management/customers')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.customers[0]).toHaveProperty('total_profit')
    expect(res.body.customers[0].total_profit).toBe(120000)
  })
})

describe('GET /api/management/customers/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 404 when customer does not exist', async () => {
    prismaInstance.customer.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .get('/api/management/customers/99999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 200 with customer detail and stats', async () => {
    prismaInstance.customer.findUnique.mockResolvedValueOnce(mockCustomer)
    prismaInstance.sale.count.mockResolvedValueOnce(3)
    prismaInstance.sale.aggregate
      .mockResolvedValueOnce({ _sum: { totalSalePrice: 300000 } })
      .mockResolvedValueOnce({ _sum: { totalProfit: 90000 } })
    prismaInstance.sale.findMany.mockResolvedValueOnce([])
    prismaInstance.saleLine.count.mockResolvedValue(0)

    const res = await request(app)
      .get('/api/management/customers/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('customer')
    expect(res.body).toHaveProperty('stats')
    expect(res.body).toHaveProperty('sales')
    expect(res.body).toHaveProperty('pagination')
    expect(res.body.customer.username_shopee).toBe('shopee_buyer')
    expect(res.body.stats.total_sales_count).toBe(3)
  })
})

describe('POST /api/management/customers', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 400 when both username_shopee and nomor_hp are missing', async () => {
    const res = await request(app)
      .post('/api/management/customers')
      .set('Authorization', authHeader)
      .send({})

    expect(res.status).toBe(400)
  })

  it('allows creating a customer with only nomor_hp (no username_shopee)', async () => {
    prismaInstance.customer.findFirst.mockResolvedValueOnce(null)
    prismaInstance.customer.create.mockResolvedValueOnce(mockCustomer)

    const res = await request(app)
      .post('/api/management/customers')
      .set('Authorization', authHeader)
      .send({ nomor_hp: '08123456789' })

    expect(res.status).toBe(201)
  })

  it('returns 400 when customer with username already exists in same source', async () => {
    prismaInstance.customer.findFirst.mockResolvedValueOnce({ id: 99 })

    const res = await request(app)
      .post('/api/management/customers')
      .set('Authorization', authHeader)
      .send({ username_shopee: 'existing_buyer', source_id: 1 })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/already exists/i)
  })

  it('returns 201 with created customer', async () => {
    prismaInstance.customer.findFirst.mockResolvedValueOnce(null)
    prismaInstance.customer.create.mockResolvedValueOnce(mockCustomer)

    const res = await request(app)
      .post('/api/management/customers')
      .set('Authorization', authHeader)
      .send({ username_shopee: 'new_buyer', nomor_hp: '08123', source_id: 1 })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body).toHaveProperty('customer')
  })
})

describe('PUT /api/management/customers/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 400 when both username_shopee and nomor_hp are missing', async () => {
    const res = await request(app)
      .put('/api/management/customers/1')
      .set('Authorization', authHeader)
      .send({})

    expect(res.status).toBe(400)
  })

  it('allows updating a customer with only nomor_hp (no username_shopee)', async () => {
    prismaInstance.customer.findFirst.mockResolvedValueOnce(null)
    const updated = { ...mockCustomer, usernameSh: null, nomorHp: '08111' }
    prismaInstance.customer.update.mockResolvedValueOnce(updated)

    const res = await request(app)
      .put('/api/management/customers/1')
      .set('Authorization', authHeader)
      .send({ nomor_hp: '08111' })

    expect(res.status).toBe(200)
  })

  it('returns 200 with updated customer', async () => {
    prismaInstance.customer.findFirst.mockResolvedValueOnce(null) // no duplicate
    const updated = { ...mockCustomer, usernameSh: 'updated_buyer' }
    prismaInstance.customer.update.mockResolvedValueOnce(updated)

    const res = await request(app)
      .put('/api/management/customers/1')
      .set('Authorization', authHeader)
      .send({ username_shopee: 'updated_buyer' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.customer.usernameSh).toBe('updated_buyer')
  })
})

describe('DELETE /api/management/customers/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 on successful deletion', async () => {
    prismaInstance.customer.delete.mockResolvedValueOnce(mockCustomer)

    const res = await request(app)
      .delete('/api/management/customers/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })

  it('returns 500 when db delete fails', async () => {
    prismaInstance.customer.delete.mockRejectedValueOnce(new Error('FK constraint'))

    const res = await request(app)
      .delete('/api/management/customers/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})
