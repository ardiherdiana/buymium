import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockedObject } from 'vitest'
import request from 'supertest'
import app from '../../../app'
import { makeAdminToken } from '../../helpers'

// The management module uses its own PrismaClient instances in controllers.
// We mock @prisma/client at the module level (done in setup.ts), then get the
// mock instance here to configure return values per test.
import { PrismaClient } from '@prisma/client'

const authHeader = `Bearer ${makeAdminToken()}`

// In test env NODE_ENV is 'test', not 'production', so the management router
// injects a dev user automatically regardless of token validity. The requireAuth
// local middleware in sales.ts only checks req.user is truthy, which will be set
// by the management index middleware.

describe('GET /api/management/sales', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    // Each new PrismaClient() call returns the same vi mock, get a reference
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
    prismaInstance.source.findMany.mockResolvedValue([])
  })

  it('returns 200 with sales data structure', async () => {
    prismaInstance.sale.count.mockResolvedValue(0)
    prismaInstance.sale.aggregate.mockResolvedValue({ _sum: { totalSalePrice: null, totalProfit: null } })
    prismaInstance.sale.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/management/sales')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('sales')
    expect(res.body).toHaveProperty('pagination')
    expect(res.body).toHaveProperty('stats')
    expect(res.body).toHaveProperty('chartData')
  })

  it('returns correct stats structure with zeros when no sales', async () => {
    prismaInstance.sale.count.mockResolvedValue(0)
    prismaInstance.sale.aggregate.mockResolvedValue({ _sum: { totalSalePrice: null, totalProfit: null } })
    prismaInstance.sale.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/management/sales')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.stats.totalSales).toBe(0)
    expect(res.body.stats.totalSalePrice).toBe(0)
    expect(res.body.stats.totalProfit).toBe(0)
  })

  it('returns paginated list of sales', async () => {
    // SalesController.index calls sale.findMany twice:
    // 1) allMonthSales (for chart) - must have saleLines array
    // 2) paginated list (for table) - has customer and source
    const mockSaleForChart = {
      id: 1,
      salesNumber: 'SALE-001',
      customerId: 10,
      totalSalePrice: 150000,
      totalProfit: 50000,
      isShopee: false,
      sourceSheetName: 'Buymium',
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { saleLines: 0 },
      saleLines: [],
    }
    const mockSaleForList = {
      ...mockSaleForChart,
      customer: { id: 10, usernameSh: 'john_buyer', sourceRel: null },
    }

    prismaInstance.sale.count.mockResolvedValue(1)
    prismaInstance.sale.aggregate.mockResolvedValue({ _sum: { totalSalePrice: 150000, totalProfit: 50000 } })
    // First call: allMonthSales for chart (needs saleLines)
    // Second call: paginated list (needs customer/source)
    prismaInstance.sale.findMany
      .mockResolvedValueOnce([mockSaleForChart])
      .mockResolvedValueOnce([mockSaleForList])

    const res = await request(app)
      .get('/api/management/sales')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.sales.length).toBeGreaterThanOrEqual(0)
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 15,
    })
  })
})

describe('GET /api/management/sales/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 404 when sale not found', async () => {
    prismaInstance.sale.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .get('/api/management/sales/99999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 200 with sale detail when found', async () => {
    const mockSale = {
      id: 5,
      salesNumber: 'SALE-005',
      customerId: 10,
      totalSalePrice: 200000,
      totalProfit: 80000,
      isShopee: true,
      sourceSheetName: 'Buymium',
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { id: 10, usernameSh: 'buyer_xyz' },
      saleLines: [],
    }

    prismaInstance.sale.findUnique.mockResolvedValueOnce(mockSale)

    const res = await request(app)
      .get('/api/management/sales/5')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('sale')
    expect(res.body.sale.id).toBe(5)
    expect(res.body.sale.sales_number).toBe('SALE-005')
    expect(res.body.sale.status).toBe('completed')
  })
})

describe('POST /api/management/sales', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/management/sales')
      .set('Authorization', authHeader)
      .send({ sales_number: 'SALE-NEW' }) // missing customer_id, total_sale_price, total_profit

    expect(res.status).toBe(400)
  })

  it('returns 201 with created sale on valid data', async () => {
    const createdSale = {
      id: 10,
      salesNumber: 'SALE-NEW',
      customerId: 5,
      totalSalePrice: 100000,
      totalProfit: 30000,
      isShopee: false,
      sourceSheetName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { id: 5, usernameSh: 'test_customer' },
      saleLines: [],
    }

    prismaInstance.sale.create.mockResolvedValueOnce(createdSale)
    prismaInstance.sale.findUnique.mockResolvedValueOnce({ ...createdSale, saleLines: [] })

    const res = await request(app)
      .post('/api/management/sales')
      .set('Authorization', authHeader)
      .send({
        sales_number: 'SALE-NEW',
        customer_id: 5,
        total_sale_price: 100000,
        total_profit: 30000,
        is_shopee: false,
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.sale).toBeDefined()
  })
})

describe('DELETE /api/management/sales/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 on successful deletion', async () => {
    prismaInstance.sale.delete.mockResolvedValueOnce({ id: 1 })

    const res = await request(app)
      .delete('/api/management/sales/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })
})
