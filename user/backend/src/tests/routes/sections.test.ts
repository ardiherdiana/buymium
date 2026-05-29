import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { mockDb } from '../setup'
import { makeUserToken, makeAdminToken } from '../helpers'

const userToken = makeUserToken(1)
const adminToken = makeAdminToken(99)

const mockSection = {
  id: 'streaming',
  title: 'Streaming',
  subtitle: 'Layanan streaming terbaik',
  order: 1,
  products: [
    {
      id: 1,
      title: 'Netflix Premium',
      description: 'Akun Netflix',
      inStock: 5,
      price: 50000,
      rating: 4.5,
      isVerified: true,
      tags: '["streaming"]',
      sectionId: 'streaming',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
}

describe('GET /api/sections', () => {
  it('returns 200 with sections and their listings', async () => {
    mockDb.productSection.findMany.mockResolvedValue([mockSection])

    const res = await request(app).get('/api/sections')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].id).toBe('streaming')
    expect(res.body[0].listings).toBeDefined()
    expect(Array.isArray(res.body[0].listings)).toBe(true)
  })

  it('returns 200 with empty array when no sections exist', async () => {
    mockDb.productSection.findMany.mockResolvedValue([])

    const res = await request(app).get('/api/sections')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('parses tags as array in product listings', async () => {
    mockDb.productSection.findMany.mockResolvedValue([mockSection])

    const res = await request(app).get('/api/sections')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body[0].listings[0].tags)).toBe(true)
    expect(res.body[0].listings[0].tags).toEqual(['streaming'])
  })

  it('does not expose raw products key (renamed to listings)', async () => {
    mockDb.productSection.findMany.mockResolvedValue([mockSection])

    const res = await request(app).get('/api/sections')

    expect(res.status).toBe(200)
    expect(res.body[0].products).toBeUndefined()
  })
})

describe('GET /api/sections/:id', () => {
  it('returns 200 when section exists', async () => {
    mockDb.productSection.findUnique.mockResolvedValue(mockSection)

    const res = await request(app).get('/api/sections/streaming')

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('streaming')
    expect(res.body.listings).toBeDefined()
  })

  it('returns 404 when section does not exist', async () => {
    mockDb.productSection.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/sections/nonexistent')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Section tidak ditemukan')
  })
})

describe('POST /api/sections (admin)', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app)
      .post('/api/sections')
      .send({ id: 'gaming', title: 'Gaming' })

    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request(app)
      .post('/api/sections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ id: 'gaming', title: 'Gaming' })

    expect(res.status).toBe(403)
  })

  it('returns 400 when id or title is missing', async () => {
    const res = await request(app)
      .post('/api/sections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'No ID' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('id dan title wajib diisi')
  })

  it('returns 201 with created section for admin', async () => {
    const newSection = { id: 'gaming', title: 'Gaming', subtitle: '', order: 1 }
    mockDb.productSection.create.mockResolvedValue(newSection)

    const res = await request(app)
      .post('/api/sections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: 'gaming', title: 'Gaming', order: 1 })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe('gaming')
    expect(res.body.title).toBe('Gaming')
  })
})

describe('PUT /api/sections/:id (admin)', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app)
      .put('/api/sections/streaming')
      .send({ title: 'Updated' })

    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .put('/api/sections/streaming')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Updated' })

    expect(res.status).toBe(403)
  })

  it('returns 200 with updated section for admin', async () => {
    const updatedSection = { id: 'streaming', title: 'Streaming Updated', subtitle: '', order: 1 }
    mockDb.productSection.update.mockResolvedValue(updatedSection)

    const res = await request(app)
      .put('/api/sections/streaming')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Streaming Updated' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Streaming Updated')
  })
})

describe('DELETE /api/sections/:id (admin)', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).delete('/api/sections/streaming')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .delete('/api/sections/streaming')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(403)
  })

  it('returns 200 on successful deletion for admin', async () => {
    mockDb.productSection.delete.mockResolvedValue({ id: 'streaming' })

    const res = await request(app)
      .delete('/api/sections/streaming')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Section dihapus')
  })
})
