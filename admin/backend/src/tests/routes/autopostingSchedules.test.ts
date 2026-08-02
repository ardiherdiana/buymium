import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import db from '../../config/database'
import { makeAdminToken, makeUserToken } from '../helpers'

const mockDb = vi.mocked(db)
const authHeader = `Bearer ${makeAdminToken()}`

const mockSchedule = {
  id: 1,
  userId: 1,
  channelId: 5,
  day: 'Sunday',
  isActive: true,
  slots: JSON.stringify(['09:00 AM', '05:00 PM']),
}

describe('GET /api/autoposting/schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/autoposting/schedules?channel_id=5')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .get('/api/autoposting/schedules?channel_id=5')
      .set('Authorization', `Bearer ${makeUserToken()}`)

    expect(res.status).toBe(403)
  })

  it('returns 400 when channel_id is missing', async () => {
    const res = await request(app)
      .get('/api/autoposting/schedules')
      .set('Authorization', authHeader)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/channel_id/i)
  })

  it('returns existing schedules with parsed slots', async () => {
    mockDb.autopostingSchedule.findMany.mockResolvedValueOnce([mockSchedule])

    const res = await request(app)
      .get('/api/autoposting/schedules?channel_id=5')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0]).toEqual({
      id: 1,
      day: 'Sunday',
      isActive: true,
      slots: ['09:00 AM', '05:00 PM'],
      channelId: 5,
    })
    expect(mockDb.autopostingSchedule.createMany).not.toHaveBeenCalled()
  })

  it('auto-creates default schedules for all 7 days when none exist', async () => {
    mockDb.autopostingSchedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockSchedule])
    mockDb.autopostingSchedule.createMany.mockResolvedValueOnce({ count: 7 })

    const res = await request(app)
      .get('/api/autoposting/schedules?channel_id=5')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(mockDb.autopostingSchedule.createMany).toHaveBeenCalledTimes(1)
    expect(mockDb.autopostingSchedule.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ day: 'Sunday', channelId: 5 }),
        ]),
      })
    )
    const callArg = mockDb.autopostingSchedule.createMany.mock.calls[0][0]
    expect(callArg.data).toHaveLength(7)
  })
})

describe('PUT /api/autoposting/schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put('/api/autoposting/schedules')
      .send({ schedules: [] })
    expect(res.status).toBe(401)
  })

  it('returns 400 when schedules is not an array', async () => {
    const res = await request(app)
      .put('/api/autoposting/schedules')
      .set('Authorization', authHeader)
      .send({ schedules: 'not-an-array' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/array/i)
  })

  it('updates each schedule and returns a success message', async () => {
    mockDb.autopostingSchedule.updateMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .put('/api/autoposting/schedules')
      .set('Authorization', authHeader)
      .send({
        schedules: [
          { id: 1, isActive: false, slots: ['10:00 AM'] },
          { id: 2, isActive: true, slots: ['08:00 AM', '06:00 PM'] },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/updated successfully/i)
    expect(mockDb.autopostingSchedule.updateMany).toHaveBeenCalledTimes(2)
    expect(mockDb.autopostingSchedule.updateMany).toHaveBeenCalledWith({
      where: { id: 1, userId: 1 },
      data: { isActive: false, slots: JSON.stringify(['10:00 AM']) },
    })
  })
})
