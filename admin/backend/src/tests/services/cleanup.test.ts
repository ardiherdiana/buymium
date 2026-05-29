import { describe, it, expect, vi, beforeEach } from 'vitest'

// setup.ts mocks '../services/cleanup' entirely with { startCleanup: vi.fn() }.
// We need to unmock it and test the real implementation.

const mockScheduleFn = vi.fn()
const mockExistsSync = vi.fn().mockReturnValue(false)
const mockUnlinkSync = vi.fn()

vi.mock('node-cron', () => ({
  default: {
    schedule: mockScheduleFn,
  },
}))

vi.mock('fs', async (importOriginal) => {
  const original = (await importOriginal()) as typeof import('fs')
  return {
    ...original,
    default: {
      ...(original.default as object),
      existsSync: mockExistsSync,
      unlinkSync: mockUnlinkSync,
    },
    existsSync: mockExistsSync,
    unlinkSync: mockUnlinkSync,
  }
})

// Unmock the cleanup service so we test the real implementation
vi.unmock('../../services/cleanup')

// db is already mocked via setup.ts (vi.mock('../config/database'))
import db from '../../config/database'

const { startCleanup } = await import('../../services/cleanup')

const mockDb = vi.mocked(db)

describe('startCleanup', () => {
  beforeEach(() => {
    mockScheduleFn.mockReset()
    mockExistsSync.mockReset()
    mockUnlinkSync.mockReset()
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  it('calls cron.schedule with daily-at-midnight expression', () => {
    startCleanup()
    expect(mockScheduleFn).toHaveBeenCalledWith(
      '0 0 * * *',
      expect.any(Function)
    )
  })

  it('registers exactly one cron job', () => {
    startCleanup()
    expect(mockScheduleFn).toHaveBeenCalledTimes(1)
  })

  it('cleanup callback finds published posts older than 3 months', async () => {
    let cleanupCallback: (() => Promise<void>) | undefined
    mockScheduleFn.mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
      cleanupCallback = cb
    })

    startCleanup()

    mockDb.autopostingPost.findMany.mockResolvedValueOnce([])

    await cleanupCallback!()

    expect(mockDb.autopostingPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'published',
          postedAt: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      })
    )

    const callArgs = mockDb.autopostingPost.findMany.mock.calls[0][0]
    const cutoffDate: Date = callArgs.where.postedAt.lte
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    expect(Math.abs(cutoffDate.getTime() - threeMonthsAgo.getTime())).toBeLessThan(60_000)
  })

  it('deletes image files for old posts that have imageUrl', async () => {
    let cleanupCallback: (() => Promise<void>) | undefined
    mockScheduleFn.mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
      cleanupCallback = cb
    })

    startCleanup()

    const oldPost = {
      id: 5,
      status: 'published',
      imageUrl: '/uploads/autoposting/old-image.jpg',
      postedAt: new Date('2024-01-01'),
    }
    mockDb.autopostingPost.findMany.mockResolvedValueOnce([oldPost])
    mockExistsSync.mockReturnValueOnce(true)

    await cleanupCallback!()

    expect(mockExistsSync).toHaveBeenCalled()
    expect(mockUnlinkSync).toHaveBeenCalled()
  })

  it('does not call unlinkSync when image file does not exist on disk', async () => {
    let cleanupCallback: (() => Promise<void>) | undefined
    mockScheduleFn.mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
      cleanupCallback = cb
    })

    startCleanup()

    const oldPost = {
      id: 6,
      status: 'published',
      imageUrl: '/uploads/autoposting/missing.jpg',
      postedAt: new Date('2024-01-01'),
    }
    mockDb.autopostingPost.findMany.mockResolvedValueOnce([oldPost])
    mockExistsSync.mockReturnValueOnce(false)

    await cleanupCallback!()

    expect(mockExistsSync).toHaveBeenCalled()
    expect(mockUnlinkSync).not.toHaveBeenCalled()
  })

  it('skips file deletion for posts without imageUrl', async () => {
    let cleanupCallback: (() => Promise<void>) | undefined
    mockScheduleFn.mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
      cleanupCallback = cb
    })

    startCleanup()

    const oldPost = {
      id: 7,
      status: 'published',
      imageUrl: null,
      postedAt: new Date('2024-01-01'),
    }
    mockDb.autopostingPost.findMany.mockResolvedValueOnce([oldPost])

    await cleanupCallback!()

    expect(mockExistsSync).not.toHaveBeenCalled()
    expect(mockUnlinkSync).not.toHaveBeenCalled()
  })

  it('handles db errors gracefully without throwing', async () => {
    let cleanupCallback: (() => Promise<void>) | undefined
    mockScheduleFn.mockImplementationOnce((_expr: string, cb: () => Promise<void>) => {
      cleanupCallback = cb
    })

    startCleanup()

    mockDb.autopostingPost.findMany.mockRejectedValueOnce(new Error('DB error'))

    await expect(cleanupCallback!()).resolves.not.toThrow()
  })
})
