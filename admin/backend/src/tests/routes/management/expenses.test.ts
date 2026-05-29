import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockedObject } from 'vitest'
import request from 'supertest'
import app from '../../../app'
import { makeAdminToken } from '../../helpers'
import { PrismaClient } from '@prisma/client'

// ExpensesController uses `new PrismaClient()` directly.

const authHeader = `Bearer ${makeAdminToken()}`

const mockExpense = {
  id: 1,
  amount: 150000,
  expenseDate: new Date('2025-01-15').toISOString(),
  categoryId: 1,
  sourceId: null,
  category: { id: 1, name: 'Marketing' },
  source: null,
}

describe('GET /api/management/expenses', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 with expenses and pagination structure', async () => {
    prismaInstance.expense.findMany.mockResolvedValueOnce([mockExpense])
    prismaInstance.expense.count.mockResolvedValueOnce(1)
    prismaInstance.expenseCategory.findMany.mockResolvedValueOnce([{ id: 1, name: 'Marketing' }])
    prismaInstance.source.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/management/expenses')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('expenses')
    expect(res.body).toHaveProperty('pagination')
    expect(res.body).toHaveProperty('categories')
    expect(res.body).toHaveProperty('sources')
    expect(res.body).toHaveProperty('filters')
  })

  it('returns empty expenses list when none exist', async () => {
    prismaInstance.expense.findMany.mockResolvedValueOnce([])
    prismaInstance.expense.count.mockResolvedValueOnce(0)
    prismaInstance.expenseCategory.findMany.mockResolvedValueOnce([])
    prismaInstance.source.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/management/expenses')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.expenses).toHaveLength(0)
    expect(res.body.pagination.total).toBe(0)
  })

  it('accepts year and month filter params', async () => {
    prismaInstance.expense.findMany.mockResolvedValueOnce([mockExpense])
    prismaInstance.expense.count.mockResolvedValueOnce(1)
    prismaInstance.expenseCategory.findMany.mockResolvedValueOnce([])
    prismaInstance.source.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/management/expenses?year=2025&month=1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.filters.year).toBe('2025')
    expect(res.body.filters.month).toBe('1')
  })

  it('accepts category_id filter param', async () => {
    prismaInstance.expense.findMany.mockResolvedValueOnce([])
    prismaInstance.expense.count.mockResolvedValueOnce(0)
    prismaInstance.expenseCategory.findMany.mockResolvedValueOnce([])
    prismaInstance.source.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/management/expenses?category_id=1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.filters.category_id).toBe('1')
  })
})

describe('POST /api/management/expenses', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/management/expenses')
      .set('Authorization', authHeader)
      .send({ amount: 50000 }) // missing expense_date and category_id

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 400 when amount is missing', async () => {
    const res = await request(app)
      .post('/api/management/expenses')
      .set('Authorization', authHeader)
      .send({ expense_date: '2025-01-15', category_id: 1 }) // missing amount

    expect(res.status).toBe(400)
  })

  it('returns 201 with created expense on valid data', async () => {
    prismaInstance.expense.create.mockResolvedValueOnce(mockExpense)

    const res = await request(app)
      .post('/api/management/expenses')
      .set('Authorization', authHeader)
      .send({
        amount: 150000,
        expense_date: '2025-01-15',
        category_id: 1,
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body).toHaveProperty('expense')
    expect(res.body.expense.amount).toBe(150000)
  })
})

describe('PUT /api/management/expenses/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .put('/api/management/expenses/1')
      .set('Authorization', authHeader)
      .send({ amount: 200000 }) // missing expense_date and category_id

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 200 with updated expense', async () => {
    const updated = { ...mockExpense, amount: 200000 }
    prismaInstance.expense.update.mockResolvedValueOnce(updated)

    const res = await request(app)
      .put('/api/management/expenses/1')
      .set('Authorization', authHeader)
      .send({
        amount: 200000,
        expense_date: '2025-02-01',
        category_id: 1,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.expense.amount).toBe(200000)
  })
})

describe('DELETE /api/management/expenses/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 on successful deletion', async () => {
    prismaInstance.expense.delete.mockResolvedValueOnce(mockExpense)

    const res = await request(app)
      .delete('/api/management/expenses/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })

  it('returns 500 when db delete fails', async () => {
    prismaInstance.expense.delete.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(app)
      .delete('/api/management/expenses/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})
