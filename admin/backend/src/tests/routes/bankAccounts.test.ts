import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken, makeUserToken } from '../helpers'

const mockDb = vi.mocked(db)
const authHeader = `Bearer ${makeAdminToken()}`

const mockAccount = {
  id: 1,
  bankName: 'BCA',
  accountHolder: 'John Doe',
  accountNumber: '1234567890',
  logo: null,
  isActive: true,
}

describe('GET /api/bank-accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/bank-accounts')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .get('/api/bank-accounts')
      .set('Authorization', `Bearer ${makeUserToken()}`)

    expect(res.status).toBe(403)
  })

  it('returns 200 with list of bank accounts ordered by id', async () => {
    mockDb.bankAccount.findMany.mockResolvedValueOnce([mockAccount])

    const res = await request(app)
      .get('/api/bank-accounts')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(mockDb.bankAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: 'asc' } })
    )
  })

  it('returns 500 when the database call fails', async () => {
    mockDb.bankAccount.findMany.mockRejectedValueOnce(new Error('db down'))

    const res = await request(app)
      .get('/api/bank-accounts')
      .set('Authorization', authHeader)

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })
})

describe('POST /api/bank-accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when bankName is missing', async () => {
    const res = await request(app)
      .post('/api/bank-accounts')
      .set('Authorization', authHeader)
      .send({ accountHolder: 'John Doe', accountNumber: '1234567890' })

    expect(res.status).toBe(400)
  })

  it('returns 201 with created bank account', async () => {
    mockDb.bankAccount.create.mockResolvedValueOnce(mockAccount)

    const res = await request(app)
      .post('/api/bank-accounts')
      .set('Authorization', authHeader)
      .send({
        bankName: 'BCA',
        accountHolder: 'John Doe',
        accountNumber: '1234567890',
      })

    expect(res.status).toBe(201)
    expect(res.body.bankName).toBe('BCA')
    expect(mockDb.bankAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bankName: 'BCA', isActive: true }),
      })
    )
  })
})

describe('PATCH /api/bank-accounts/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .patch('/api/bank-accounts/1')
      .set('Authorization', authHeader)
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 200 with updated bank account', async () => {
    const updated = { ...mockAccount, bankName: 'Mandiri' }
    mockDb.bankAccount.update.mockResolvedValueOnce(updated)

    const res = await request(app)
      .patch('/api/bank-accounts/1')
      .set('Authorization', authHeader)
      .send({ bankName: 'Mandiri' })

    expect(res.status).toBe(200)
    expect(res.body.bankName).toBe('Mandiri')
  })
})

describe('DELETE /api/bank-accounts/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with success message', async () => {
    mockDb.bankAccount.delete.mockResolvedValueOnce(mockAccount)

    const res = await request(app)
      .delete('/api/bank-accounts/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted/i)
  })

  it('returns 500 when delete fails', async () => {
    mockDb.bankAccount.delete.mockRejectedValueOnce(new Error('not found'))

    const res = await request(app)
      .delete('/api/bank-accounts/999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(500)
  })
})
