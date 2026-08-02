import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken, makeUserToken } from '../helpers'

vi.mock('../../services/socialbu')

import * as socialbu from '../../services/socialbu'

const mockDb = vi.mocked(db)
const mockSocialbu = vi.mocked(socialbu)
const authHeader = `Bearer ${makeAdminToken()}`

const mockPost = {
  id: 1,
  userId: 1,
  channelId: 5,
  caption: 'Hello world',
  source: null,
  imageUrl: null,
  scheduledTime: null,
  status: 'drafted',
  socialBuId: null,
  createdAt: new Date(),
  postedAt: null,
}

describe('GET /api/autoposting/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/autoposting/posts')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .get('/api/autoposting/posts')
      .set('Authorization', `Bearer ${makeUserToken()}`)
    expect(res.status).toBe(403)
  })

  it('returns paginated posts for admin', async () => {
    mockDb.autopostingPost.count.mockResolvedValueOnce(1)
    mockDb.autopostingPost.findMany.mockResolvedValueOnce([mockPost])

    const res = await request(app)
      .get('/api/autoposting/posts')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([JSON.parse(JSON.stringify(mockPost))])
    expect(res.body.total).toBe(1)
    expect(res.body.page).toBe(1)
  })
})

describe('POST /api/autoposting/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/autoposting/posts').send({ caption: 'hi' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .post('/api/autoposting/posts')
      .set('Authorization', `Bearer ${makeUserToken()}`)
      .send({ caption: 'hi', channelIds: 5 })
    expect(res.status).toBe(403)
  })

  it('returns 400 when channelIds is missing', async () => {
    const res = await request(app)
      .post('/api/autoposting/posts')
      .set('Authorization', authHeader)
      .send({ caption: 'hi' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/channelIds/i)
  })

  it('returns 400 for an invalid scheduledTime', async () => {
    const res = await request(app)
      .post('/api/autoposting/posts')
      .set('Authorization', authHeader)
      .send({ caption: 'hi', channelIds: 5, scheduledTime: 'not-a-date' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/scheduledTime/i)
  })

  it('creates a drafted post without touching SocialBu', async () => {
    mockDb.autopostingPost.create.mockResolvedValueOnce(mockPost)

    const res = await request(app)
      .post('/api/autoposting/posts')
      .set('Authorization', authHeader)
      .send({ caption: 'Hello world', channelIds: 5, status: 'drafted' })

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(JSON.parse(JSON.stringify(mockPost)))
    expect(mockSocialbu.createPost).not.toHaveBeenCalled()
    expect(mockDb.channel.findUnique).not.toHaveBeenCalled()
  })

  it('returns 400 when scheduling to a channel with no SocialBu ID', async () => {
    mockDb.channel.findUnique.mockResolvedValueOnce({ id: 5, socialBuId: null })

    const res = await request(app)
      .post('/api/autoposting/posts')
      .set('Authorization', authHeader)
      .send({ caption: 'Hello', channelIds: 5, status: 'scheduled' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/SocialBu/i)
  })

  it('publishes to SocialBu and creates the post when status is scheduled', async () => {
    mockDb.channel.findUnique.mockResolvedValueOnce({ id: 5, socialBuId: '999', type: 'tiktok' })
    mockSocialbu.createPost.mockResolvedValueOnce('sb-post-1')
    mockDb.autopostingPost.create.mockResolvedValueOnce({ ...mockPost, status: 'scheduled', socialBuId: 'sb-post-1' })

    const res = await request(app)
      .post('/api/autoposting/posts')
      .set('Authorization', authHeader)
      .send({ caption: 'Hello', channelIds: 5, status: 'scheduled' })

    expect(res.status).toBe(200)
    expect(mockSocialbu.createPost).toHaveBeenCalled()
    expect(mockDb.autopostingPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ socialBuId: 'sb-post-1' }) })
    )
  })
})

describe('PUT /api/autoposting/posts/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).put('/api/autoposting/posts/1').send({ caption: 'x' })
    expect(res.status).toBe(401)
  })

  it('returns 404 when post is not found', async () => {
    mockDb.autopostingPost.findFirst.mockResolvedValueOnce(null)

    const res = await request(app)
      .put('/api/autoposting/posts/1')
      .set('Authorization', authHeader)
      .send({ caption: 'x' })

    expect(res.status).toBe(404)
  })

  it('updates caption on an existing post', async () => {
    mockDb.autopostingPost.findFirst.mockResolvedValueOnce(mockPost)
    mockDb.autopostingPost.update.mockResolvedValueOnce({ ...mockPost, caption: 'Updated' })

    const res = await request(app)
      .put('/api/autoposting/posts/1')
      .set('Authorization', authHeader)
      .send({ caption: 'Updated' })

    expect(res.status).toBe(200)
    expect(res.body.data.caption).toBe('Updated')
    expect(mockDb.autopostingPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ caption: 'Updated' }) })
    )
  })
})

describe('DELETE /api/autoposting/posts/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/autoposting/posts/1')
    expect(res.status).toBe(401)
  })

  it('returns 404 when post is not found', async () => {
    mockDb.autopostingPost.findFirst.mockResolvedValueOnce(null)

    const res = await request(app)
      .delete('/api/autoposting/posts/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
  })

  it('deletes the post successfully', async () => {
    mockDb.autopostingPost.findFirst.mockResolvedValueOnce(mockPost)
    mockDb.autopostingPost.delete.mockResolvedValueOnce(mockPost)

    const res = await request(app)
      .delete('/api/autoposting/posts/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted successfully/i)
  })
})

describe('DELETE /api/autoposting/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/autoposting/posts')
    expect(res.status).toBe(401)
  })

  it('deletes all posts for the user', async () => {
    mockDb.autopostingPost.findMany.mockResolvedValueOnce([mockPost])
    mockDb.autopostingPost.deleteMany.mockResolvedValueOnce({ count: 1 })

    const res = await request(app)
      .delete('/api/autoposting/posts')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/all posts deleted successfully/i)
    expect(mockDb.autopostingPost.deleteMany).toHaveBeenCalled()
  })
})
