import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken, makeUserToken } from '../helpers'

const mockDb = vi.mocked(db)
const authHeader = `Bearer ${makeAdminToken()}`

const mockTestimonial = {
  id: 1,
  productId: 10,
  createdById: 2,
  content: 'Great product!',
  isPublished: false,
  createdAt: new Date(),
  product: { id: 10, title: 'Netflix Premium' },
  createdBy: { id: 2, name: 'Jane' },
}

describe('GET /api/testimonials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/testimonials')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .get('/api/testimonials')
      .set('Authorization', `Bearer ${makeUserToken()}`)

    expect(res.status).toBe(403)
  })

  it('returns 200 with all testimonials when no productId filter given', async () => {
    mockDb.testimonial.findMany.mockResolvedValueOnce([mockTestimonial])

    const res = await request(app)
      .get('/api/testimonials')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(mockDb.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    )
  })

  it('filters by productId when provided as a query param', async () => {
    mockDb.testimonial.findMany.mockResolvedValueOnce([mockTestimonial])

    const res = await request(app)
      .get('/api/testimonials?productId=10')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(mockDb.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 10 } })
    )
  })

  it('returns 500 when the database call fails', async () => {
    mockDb.testimonial.findMany.mockRejectedValueOnce(new Error('db down'))

    const res = await request(app)
      .get('/api/testimonials')
      .set('Authorization', authHeader)

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })
})

describe('PATCH /api/testimonials/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 and updates isPublished', async () => {
    const updated = { ...mockTestimonial, isPublished: true }
    mockDb.testimonial.update.mockResolvedValueOnce(updated)

    const res = await request(app)
      .patch('/api/testimonials/1')
      .set('Authorization', authHeader)
      .send({ isPublished: true })

    expect(res.status).toBe(200)
    expect(res.body.isPublished).toBe(true)
    expect(mockDb.testimonial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { isPublished: true },
      })
    )
  })

  it('returns 500 when the testimonial does not exist', async () => {
    mockDb.testimonial.update.mockRejectedValueOnce(new Error('Record not found'))

    const res = await request(app)
      .patch('/api/testimonials/999')
      .set('Authorization', authHeader)
      .send({ isPublished: true })

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })
})

describe('DELETE /api/testimonials/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with success message', async () => {
    mockDb.testimonial.delete.mockResolvedValueOnce(mockTestimonial)

    const res = await request(app)
      .delete('/api/testimonials/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted/i)
  })

  it('returns 500 when delete fails', async () => {
    mockDb.testimonial.delete.mockRejectedValueOnce(new Error('not found'))

    const res = await request(app)
      .delete('/api/testimonials/999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(500)
  })
})
