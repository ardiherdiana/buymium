import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken } from '../helpers'

const mockDb = vi.mocked(db)
const authHeader = `Bearer ${makeAdminToken()}`

const mockSection = {
  id: 'streaming',
  title: 'Streaming Services',
  subtitle: 'Netflix, Spotify, and more',
  order: 1,
  products: [],
}

describe('GET /api/sections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/sections')
    expect(res.status).toBe(401)
  })

  it('returns 200 with list of sections ordered by order field', async () => {
    mockDb.productSection.findMany.mockResolvedValueOnce([
      mockSection,
      { ...mockSection, id: 'gaming', title: 'Gaming', order: 2 },
    ])

    const res = await request(app)
      .get('/api/sections')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(2)
    // Verify ordered by 'order'
    expect(mockDb.productSection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { order: 'asc' } })
    )
  })
})

describe('GET /api/sections/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with section detail', async () => {
    mockDb.productSection.findUnique.mockResolvedValueOnce(mockSection)

    const res = await request(app)
      .get('/api/sections/streaming')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('streaming')
    expect(res.body.title).toBe('Streaming Services')
  })

  it('returns 404 when section not found', async () => {
    mockDb.productSection.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .get('/api/sections/nonexistent')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/tidak ditemukan/i)
  })
})

describe('POST /api/sections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when id is missing', async () => {
    const res = await request(app)
      .post('/api/sections')
      .set('Authorization', authHeader)
      .send({ title: 'Gaming' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/sections')
      .set('Authorization', authHeader)
      .send({ id: 'gaming' })

    expect(res.status).toBe(400)
  })

  it('returns 201 with created section', async () => {
    mockDb.productSection.create.mockResolvedValueOnce({
      id: 'gaming',
      title: 'Gaming',
      subtitle: 'PC & Console games',
      order: 3,
    })

    const res = await request(app)
      .post('/api/sections')
      .set('Authorization', authHeader)
      .send({ id: 'gaming', title: 'Gaming', subtitle: 'PC & Console games', order: 3 })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe('gaming')
    expect(res.body.title).toBe('Gaming')
  })
})

describe('PUT /api/sections/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with updated section', async () => {
    const updated = { ...mockSection, title: 'Updated Section', order: 5 }
    mockDb.productSection.update.mockResolvedValueOnce(updated)

    const res = await request(app)
      .put('/api/sections/streaming')
      .set('Authorization', authHeader)
      .send({ title: 'Updated Section', order: 5 })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated Section')
  })
})

describe('DELETE /api/sections/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with success message', async () => {
    mockDb.productSection.delete.mockResolvedValueOnce(mockSection)

    const res = await request(app)
      .delete('/api/sections/streaming')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/dihapus/i)
  })
})
