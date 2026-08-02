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

const mockChannel = {
  id: 1,
  userId: 1,
  username: 'my_tiktok',
  socialBuId: '123',
  type: 'tiktok',
  profilePhotoPath: null,
}

describe('GET /api/autoposting/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/autoposting/channels')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .get('/api/autoposting/channels')
      .set('Authorization', `Bearer ${makeUserToken()}`)
    expect(res.status).toBe(403)
  })

  it('syncs with SocialBu and returns channels for admin', async () => {
    mockSocialbu.getAccounts.mockResolvedValueOnce([
      { id: '123', name: 'My TikTok', username: 'my_tiktok', type: 'tiktok.profile' },
    ])
    mockDb.channel.findUnique.mockResolvedValueOnce(null)
    mockDb.channel.create.mockResolvedValueOnce(mockChannel)
    mockDb.channel.findMany.mockResolvedValueOnce([mockChannel])

    const res = await request(app)
      .get('/api/autoposting/channels')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([mockChannel])
    expect(mockDb.channel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ socialBuId: '123', type: 'tiktok', username: 'my_tiktok' }),
      })
    )
  })

  it('updates an existing channel instead of creating a duplicate', async () => {
    mockSocialbu.getAccounts.mockResolvedValueOnce([
      { id: '123', name: 'My TikTok', username: 'my_tiktok', type: 'tiktok.profile' },
    ])
    mockDb.channel.findUnique.mockResolvedValueOnce(mockChannel)
    mockDb.channel.update.mockResolvedValueOnce(mockChannel)
    mockDb.channel.findMany.mockResolvedValueOnce([mockChannel])

    const res = await request(app)
      .get('/api/autoposting/channels')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(mockDb.channel.create).not.toHaveBeenCalled()
    expect(mockDb.channel.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockChannel.id } })
    )
  })

  it('still returns local channels when SocialBu sync fails', async () => {
    mockSocialbu.getAccounts.mockRejectedValueOnce(new Error('SocialBu down'))
    mockDb.channel.findMany.mockResolvedValueOnce([mockChannel])

    const res = await request(app)
      .get('/api/autoposting/channels')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([mockChannel])
  })
})

describe('DELETE /api/autoposting/channels/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/autoposting/channels/1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .delete('/api/autoposting/channels/1')
      .set('Authorization', `Bearer ${makeUserToken()}`)
    expect(res.status).toBe(403)
  })

  it('deletes the channel and returns a success message', async () => {
    mockDb.channel.delete.mockResolvedValueOnce(mockChannel)

    const res = await request(app)
      .delete('/api/autoposting/channels/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted/i)
    expect(mockDb.channel.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
