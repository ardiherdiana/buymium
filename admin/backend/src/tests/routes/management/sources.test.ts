import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockedObject } from 'vitest'
import request from 'supertest'
import app from '../../../app'
import { makeAdminToken } from '../../helpers'
import { PrismaClient } from '@prisma/client'

// SourcesController uses `new PrismaClient()` directly.
// The shared mock from setup.ts is used throughout.

const authHeader = `Bearer ${makeAdminToken()}`

const mockSource = {
  id: 1,
  name: 'Main Source',
  index: 0,
  prefix: 'MS',
  color: '#ff0000',
  spreadsheetId: 'spreadsheet-id-123',
  image: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockSourceResponse = {
  id: 1,
  name: 'Main Source',
  index: 0,
  prefix: 'MS',
  color: '#ff0000',
  spreadsheet_id: 'spreadsheet-id-123',
  image_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('GET /api/management/sources', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 with sources list and pagination', async () => {
    prismaInstance.source.findMany.mockResolvedValueOnce([mockSource])
    prismaInstance.source.count.mockResolvedValueOnce(1)

    const res = await request(app)
      .get('/api/management/sources')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('sources')
    expect(res.body).toHaveProperty('pagination')
    expect(Array.isArray(res.body.sources)).toBe(true)
  })

  it('returns empty list when no sources exist', async () => {
    prismaInstance.source.findMany.mockResolvedValueOnce([])
    prismaInstance.source.count.mockResolvedValueOnce(0)

    const res = await request(app)
      .get('/api/management/sources')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.sources).toHaveLength(0)
    expect(res.body.pagination.total).toBe(0)
  })

  it('returns sources with image_url field', async () => {
    prismaInstance.source.findMany.mockResolvedValueOnce([mockSource])
    prismaInstance.source.count.mockResolvedValueOnce(1)

    const res = await request(app)
      .get('/api/management/sources')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.sources[0]).toHaveProperty('image_url')
    expect(res.body.sources[0]).toHaveProperty('spreadsheet_id')
  })

  it('respects pagination query params', async () => {
    prismaInstance.source.findMany.mockResolvedValueOnce([mockSource])
    prismaInstance.source.count.mockResolvedValueOnce(30)

    const res = await request(app)
      .get('/api/management/sources?page=2')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.pagination.page).toBe(2)
  })
})

describe('POST /api/management/sources', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/management/sources')
      .set('Authorization', authHeader)
      .field('spreadsheet_id', 'sheet-123')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 400 when spreadsheet_id is missing', async () => {
    const res = await request(app)
      .post('/api/management/sources')
      .set('Authorization', authHeader)
      .field('name', 'New Source')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 201 with created source', async () => {
    prismaInstance.source.create.mockResolvedValueOnce(mockSource)

    const res = await request(app)
      .post('/api/management/sources')
      .set('Authorization', authHeader)
      .field('name', 'New Source')
      .field('spreadsheet_id', 'sheet-123')

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body).toHaveProperty('source')
    expect(res.body.source).toHaveProperty('spreadsheet_id')
  })

  it('returns 400 on unique constraint violation', async () => {
    const err = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    prismaInstance.source.create.mockRejectedValueOnce(err)

    const res = await request(app)
      .post('/api/management/sources')
      .set('Authorization', authHeader)
      .field('name', 'Existing Source')
      .field('spreadsheet_id', 'dup-sheet-id')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/already exists/i)
  })
})

describe('PUT /api/management/sources/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .put('/api/management/sources/1')
      .set('Authorization', authHeader)
      .field('spreadsheet_id', 'sheet-123')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 200 with updated source', async () => {
    prismaInstance.source.findUnique.mockResolvedValueOnce(mockSource)
    const updated = { ...mockSource, name: 'Updated Source' }
    prismaInstance.source.update.mockResolvedValueOnce(updated)

    const res = await request(app)
      .put('/api/management/sources/1')
      .set('Authorization', authHeader)
      .field('name', 'Updated Source')
      .field('spreadsheet_id', 'sheet-123')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.source.name).toBe('Updated Source')
  })
})

describe('DELETE /api/management/sources/:id', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 on successful deletion', async () => {
    prismaInstance.source.findUnique.mockResolvedValueOnce(mockSource)
    prismaInstance.source.delete.mockResolvedValueOnce(mockSource)

    const res = await request(app)
      .delete('/api/management/sources/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })

  it('returns 500 when db delete fails', async () => {
    prismaInstance.source.findUnique.mockResolvedValueOnce(mockSource)
    prismaInstance.source.delete.mockRejectedValueOnce(new Error('FK constraint'))

    const res = await request(app)
      .delete('/api/management/sources/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})
