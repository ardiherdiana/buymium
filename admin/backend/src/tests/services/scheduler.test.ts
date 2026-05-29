import { describe, it, expect, vi, beforeEach } from 'vitest'

// setup.ts mocks '../services/scheduler' entirely with { startScheduler: vi.fn() }.
// We need to unmock it and test the real implementation instead.
// We also mock node-cron and the db so the scheduler doesn't need real resources.

const mockScheduleFn = vi.fn()

vi.mock('node-cron', () => ({
  default: {
    schedule: mockScheduleFn,
  },
}))

// Unmock the scheduler service so we test the real implementation
vi.unmock('../../services/scheduler')

// db is already mocked via setup.ts (vi.mock('../config/database'))
import db from '../../config/database'

// Import the real startScheduler after mocks are set up
const { startScheduler } = await import('../../services/scheduler')

const mockDb = vi.mocked(db)

describe('startScheduler', () => {
  beforeEach(() => {
    mockScheduleFn.mockReset()
    vi.clearAllMocks()
  })

  it('calls cron.schedule with 60-second interval expression', () => {
    startScheduler()
    expect(mockScheduleFn).toHaveBeenCalledWith(
      '*/60 * * * * *',
      expect.any(Function)
    )
  })

  it('registers exactly two cron jobs', () => {
    startScheduler()
    expect(mockScheduleFn).toHaveBeenCalledTimes(2)
  })

  it('scheduled callback finds and updates scheduled posts that are due', async () => {
    let schedulerCallback: (() => Promise<void>) | undefined
    // First call is midnight sync — skip it; second call is the 60s posts scheduler
    mockScheduleFn.mockImplementationOnce(() => { /* midnight sync, ignore */ })
    mockScheduleFn.mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
      schedulerCallback = cb
    })

    startScheduler()

    const now = new Date()
    const mockScheduledPosts = [
      { id: 10, status: 'scheduled', scheduledTime: new Date(now.getTime() - 1000) },
      { id: 11, status: 'scheduled', scheduledTime: new Date(now.getTime() - 5000) },
    ]

    mockDb.autopostingPost.findMany.mockResolvedValueOnce(mockScheduledPosts)
    mockDb.autopostingPost.updateMany = vi.fn().mockResolvedValueOnce({ count: 2 })

    await schedulerCallback!()

    expect(mockDb.autopostingPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'scheduled' }),
      })
    )
    expect(mockDb.autopostingPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [10, 11] } }),
        data: expect.objectContaining({ status: 'published' }),
      })
    )
  })

  it('scheduled callback does not call updateMany when no due posts', async () => {
    let schedulerCallback: (() => Promise<void>) | undefined
    mockScheduleFn.mockImplementationOnce(() => { /* midnight sync, ignore */ })
    mockScheduleFn.mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
      schedulerCallback = cb
    })

    startScheduler()

    mockDb.autopostingPost.findMany.mockResolvedValueOnce([])
    mockDb.autopostingPost.updateMany = vi.fn()

    await schedulerCallback!()

    expect(mockDb.autopostingPost.findMany).toHaveBeenCalled()
    expect(mockDb.autopostingPost.updateMany).not.toHaveBeenCalled()
  })

  it('scheduled callback handles db errors gracefully without throwing', async () => {
    let schedulerCallback: (() => Promise<void>) | undefined
    mockScheduleFn.mockImplementationOnce(() => { /* midnight sync, ignore */ })
    mockScheduleFn.mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
      schedulerCallback = cb
    })

    startScheduler()

    mockDb.autopostingPost.findMany.mockRejectedValueOnce(new Error('DB connection lost'))

    await expect(schedulerCallback!()).resolves.not.toThrow()
  })
})
