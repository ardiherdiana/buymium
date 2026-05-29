import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockedObject } from 'vitest'
import request from 'supertest'
import app from '../../../app'
import { makeAdminToken } from '../../helpers'
import { PrismaClient } from '@prisma/client'

// DashboardController uses `new PrismaClient()` directly.
// setup.ts intercepts all PrismaClient construction with the shared mock.

const authHeader = `Bearer ${makeAdminToken()}`

function setupDashboardMocks(prismaInstance: MockedObject<PrismaClient>) {
  prismaInstance.user.count.mockResolvedValueOnce(5)
  prismaInstance.account.count
    .mockResolvedValueOnce(10)   // completedAccounts
    .mockResolvedValueOnce(20)   // activeAccountsCount
  prismaInstance.accsmarket.count
    .mockResolvedValueOnce(3)    // completedAccsmarkets
    .mockResolvedValueOnce(7)    // activeAccsmarketsCount
  prismaInstance.customer.count.mockResolvedValueOnce(8)
  prismaInstance.sale.aggregate
    .mockResolvedValueOnce({ _sum: { totalSalePrice: 500000, totalProfit: 150000 } })
  prismaInstance.source.findMany.mockResolvedValueOnce([])
  prismaInstance.account.groupBy
    .mockResolvedValueOnce([])   // stockAcc
    .mockResolvedValueOnce([])   // accDistRaw
  prismaInstance.accsmarket.findMany.mockResolvedValueOnce([])
  prismaInstance.accsmarket.groupBy.mockResolvedValueOnce([])  // accsmarketDistRaw
  prismaInstance.user.findUnique.mockResolvedValueOnce({
    id: 1, name: 'Admin', role: { name: 'admin' },
  })
}

describe('GET /api/management/dashboard', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.resetAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 with dashboard statistics structure', async () => {
    setupDashboardMocks(prismaInstance)

    const res = await request(app)
      .get('/api/management/dashboard')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('statistics')
    expect(res.body).toHaveProperty('accounts_stock')
    expect(res.body).toHaveProperty('accsmarket_stock')
    expect(res.body).toHaveProperty('user')
  })

  it('returns correct statistics keys', async () => {
    setupDashboardMocks(prismaInstance)

    const res = await request(app)
      .get('/api/management/dashboard')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.statistics).toHaveProperty('total_users')
    expect(res.body.statistics).toHaveProperty('total_accounts')
    expect(res.body.statistics).toHaveProperty('active_accounts')
    expect(res.body.statistics).toHaveProperty('total_customers')
    expect(res.body.statistics).toHaveProperty('total_revenue')
    expect(res.body.statistics).toHaveProperty('total_profit')
  })

  it('returns zero stats when no data exists', async () => {
    prismaInstance.user.count.mockResolvedValueOnce(0)
    prismaInstance.account.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    prismaInstance.accsmarket.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    prismaInstance.customer.count.mockResolvedValueOnce(0)
    prismaInstance.sale.aggregate
      .mockResolvedValueOnce({ _sum: { totalSalePrice: null, totalProfit: null } })
    prismaInstance.source.findMany.mockResolvedValueOnce([])
    prismaInstance.account.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    prismaInstance.accsmarket.findMany.mockResolvedValueOnce([])
    prismaInstance.accsmarket.groupBy.mockResolvedValueOnce([])
    prismaInstance.user.findUnique.mockResolvedValueOnce({
      id: 1, name: 'Admin', role: { name: 'admin' },
    })

    const res = await request(app)
      .get('/api/management/dashboard')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.statistics.total_users).toBe(0)
    expect(res.body.statistics.total_accounts).toBe(0)
    expect(res.body.statistics.total_revenue).toBe(0)
    expect(res.body.statistics.total_profit).toBe(0)
  })

  it('returns accounts_stock with platforms and distribution arrays', async () => {
    setupDashboardMocks(prismaInstance)

    const res = await request(app)
      .get('/api/management/dashboard')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.accounts_stock.platforms)).toBe(true)
    expect(Array.isArray(res.body.accounts_stock.distribution)).toBe(true)
    expect(Array.isArray(res.body.accsmarket_stock.platforms)).toBe(true)
  })

  it('returns user name and role in response', async () => {
    setupDashboardMocks(prismaInstance)

    const res = await request(app)
      .get('/api/management/dashboard')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.user).toHaveProperty('name')
    expect(res.body.user).toHaveProperty('role')
  })
})
