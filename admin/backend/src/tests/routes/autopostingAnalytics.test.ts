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

describe('GET /api/autoposting/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/autoposting/analytics?channel_id=1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .get('/api/autoposting/analytics?channel_id=1')
      .set('Authorization', `Bearer ${makeUserToken()}`)
    expect(res.status).toBe(403)
  })

  it('returns 400 when channel_id is missing', async () => {
    const res = await request(app)
      .get('/api/autoposting/analytics')
      .set('Authorization', authHeader)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/channel_id/i)
  })

  it('returns 404 when channel has no SocialBu ID', async () => {
    mockDb.channel.findUnique.mockResolvedValueOnce({ id: 1, socialBuId: null })

    const res = await request(app)
      .get('/api/autoposting/analytics?channel_id=1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
  })

  it('returns analytics data on success', async () => {
    mockDb.channel.findUnique.mockResolvedValueOnce({ id: 1, socialBuId: '999' })
    mockSocialbu.getAccountsMetrics.mockResolvedValueOnce([
      { account_id: '999', metrics: { followers: [] } },
    ])
    mockSocialbu.getPostsCounts.mockResolvedValueOnce([{ date: '2026-07-01', count: 2 }])
    mockDb.autopostingPost.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/autoposting/analytics?channel_id=1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('postsCounts')
    expect(res.body).toHaveProperty('recentPosts')
  })

  it('returns 502 when the SocialBu fetch fails', async () => {
    mockDb.channel.findUnique.mockResolvedValueOnce({ id: 1, socialBuId: '999' })
    mockSocialbu.getAccountsMetrics.mockRejectedValueOnce(new Error('SocialBu down'))

    const res = await request(app)
      .get('/api/autoposting/analytics?channel_id=1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(502)
  })
})

describe('GET /api/autoposting/analytics/leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/autoposting/analytics/leaderboard')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .get('/api/autoposting/analytics/leaderboard')
      .set('Authorization', `Bearer ${makeUserToken()}`)
    expect(res.status).toBe(403)
  })

  it('returns an empty leaderboard when there are no tiktok channels', async () => {
    mockDb.channel.findMany.mockResolvedValueOnce([])

    const res = await request(app)
      .get('/api/autoposting/analytics/leaderboard')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(mockSocialbu.getAccountsMetrics).not.toHaveBeenCalled()
  })

  it('returns a leaderboard sorted by followers descending', async () => {
    mockDb.channel.findMany.mockResolvedValueOnce([
      { id: 1, username: 'low', socialBuId: '1', profilePhotoPath: null },
      { id: 2, username: 'high', socialBuId: '2', profilePhotoPath: null },
    ])
    mockSocialbu.getAccountsMetrics.mockResolvedValueOnce([
      { account_id: '1', metrics: { followers: [{ date: '2026-07-01', value: 100 }] } },
      { account_id: '2', metrics: { followers: [{ date: '2026-07-01', value: 500 }] } },
    ])

    const res = await request(app)
      .get('/api/autoposting/analytics/leaderboard')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data[0].username).toBe('high')
    expect(res.body.data[0].followers).toBe(500)
  })
})
