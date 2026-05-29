import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockedObject } from 'vitest'
import request from 'supertest'
import app from '../../../app'
import { makeAdminToken } from '../../helpers'
import { PrismaClient } from '@prisma/client'

// Mock AccsmarketsService to prevent real Google Sheets calls
vi.mock('../../../services/management/accsmarketsService', () => ({
  AccsmarketsService: {
    sync: vi.fn(),
    getAccountsForScan: vi.fn(),
    searchCustomers: vi.fn(),
    refreshFollowers: vi.fn(),
    deleteAccountFromGoogleSheets: vi.fn(),
  },
}))

const authHeader = `Bearer ${makeAdminToken()}`

const mockAccsmarket = {
  id: 1,
  orderIndex: 1,
  email: 'ig@accsmarket.com',
  passwordEmail: null,
  username: 'accs_user',
  password: 'pass123',
  twoFactorAuth: null,
  targetFollowers: 2000,
  currentFollowers: null,
  accountStatus: 'completed',
  capital: 75000,
  year: '2024',
  sheets: 'Sheet1',
  sourceId: null,
  isSold: false,
  source: null,
}

describe('GET /api/management/accsmarkets/index', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 with accsmarkets structure', async () => {
    prismaInstance.accsmarket.findMany
      .mockResolvedValueOnce([mockAccsmarket]) // main list
      .mockResolvedValueOnce([])               // sheetsData
      .mockResolvedValueOnce([])               // targetFollowersData
      .mockResolvedValueOnce([])               // yearsData
    prismaInstance.accsmarket.count
      .mockResolvedValueOnce(1)   // total
      .mockResolvedValueOnce(1)   // completed
    prismaInstance.accsmarket.aggregate.mockResolvedValueOnce({ _sum: { targetFollowers: 2000 } })
    prismaInstance.source.findMany.mockResolvedValueOnce([])
    prismaInstance.customer.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/management/accsmarkets/index')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accsmarkets')
    expect(res.body).toHaveProperty('stats')
    expect(res.body).toHaveProperty('sources')
  })

  it('returns empty accsmarkets when none exist', async () => {
    prismaInstance.accsmarket.findMany.mockResolvedValue([])
    prismaInstance.accsmarket.count.mockResolvedValue(0)
    prismaInstance.accsmarket.aggregate.mockResolvedValue({ _sum: { targetFollowers: 0 } })
    prismaInstance.source.findMany.mockResolvedValue([])
    prismaInstance.customer.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/management/accsmarkets/index')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.accsmarkets).toHaveLength(0)
    expect(res.body.stats.total_accounts).toBe(0)
  })
})

describe('POST /api/management/accsmarkets', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 201 with created accsmarket', async () => {
    prismaInstance.accsmarket.create.mockResolvedValueOnce(mockAccsmarket)

    const res = await request(app)
      .post('/api/management/accsmarkets')
      .set('Authorization', authHeader)
      .send({
        username: 'accs_user',
        target_followers: 2000,
        account_status: 'completed',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body).toHaveProperty('accsmarket')
  })

  it('returns 400 on unique constraint violation', async () => {
    const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    prismaInstance.accsmarket.create.mockRejectedValueOnce(err)

    const res = await request(app)
      .post('/api/management/accsmarkets')
      .set('Authorization', authHeader)
      .send({ email: 'dup@test.com', target_followers: 1000 })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/already exists/i)
  })
})

describe('PUT /api/management/accsmarkets/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 with updated accsmarket', async () => {
    const updated = { ...mockAccsmarket, accountStatus: 'active' }
    prismaInstance.accsmarket.update.mockResolvedValueOnce(updated)

    const res = await request(app)
      .put('/api/management/accsmarkets/1')
      .set('Authorization', authHeader)
      .send({ account_status: 'active' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.accsmarket.accountStatus).toBe('active')
  })
})

describe('DELETE /api/management/accsmarkets/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 404 when accsmarket does not exist', async () => {
    prismaInstance.accsmarket.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .delete('/api/management/accsmarkets/99999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 400 when account has been sold', async () => {
    prismaInstance.accsmarket.findUnique.mockResolvedValueOnce({ ...mockAccsmarket, isSold: true })

    const res = await request(app)
      .delete('/api/management/accsmarkets/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/cannot delete/i)
  })

  it('returns 200 on successful deletion', async () => {
    prismaInstance.accsmarket.findUnique.mockResolvedValueOnce(mockAccsmarket)
    prismaInstance.accsmarket.delete.mockResolvedValueOnce(mockAccsmarket)

    const res = await request(app)
      .delete('/api/management/accsmarkets/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })
})
