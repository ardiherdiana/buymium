import { describe, it, expect } from 'vitest'
import { mockDb } from '../setup'
import { autoRateUnratedOrders } from '../../services/autoRating'

describe('autoRateUnratedOrders', () => {
  it('creates a 5-star testimonial for a paid order past 24h with no review', async () => {
    mockDb.order.findMany.mockResolvedValueOnce([
      { id: 1, userId: 10, productId: 100, user: { name: 'Budi' } },
    ])
    mockDb.testimonial.findMany.mockResolvedValueOnce([])

    const count = await autoRateUnratedOrders()

    expect(count).toBe(1)
    expect(mockDb.testimonial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 100,
        createdById: 10,
        orderId: 1,
        customerName: 'Budi',
        rating: 5,
        isPublished: true,
      }),
    })
  })

  it('skips orders that already have a testimonial', async () => {
    mockDb.order.findMany.mockResolvedValueOnce([
      { id: 1, userId: 10, productId: 100, user: { name: 'Budi' } },
      { id: 2, userId: 11, productId: 101, user: { name: 'Ani' } },
    ])
    mockDb.testimonial.findMany.mockResolvedValueOnce([{ orderId: 1 }])

    const count = await autoRateUnratedOrders()

    expect(count).toBe(1)
    expect(mockDb.testimonial.create).toHaveBeenCalledTimes(1)
    expect(mockDb.testimonial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: 2 }),
    })
  })

  it('falls back to a generic name when the user has none set', async () => {
    mockDb.order.findMany.mockResolvedValueOnce([
      { id: 3, userId: 12, productId: 102, user: { name: '' } },
    ])
    mockDb.testimonial.findMany.mockResolvedValueOnce([])

    await autoRateUnratedOrders()

    expect(mockDb.testimonial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerName: 'Pelanggan' }),
    })
  })

  it('does nothing when there are no eligible orders', async () => {
    mockDb.order.findMany.mockResolvedValueOnce([])

    const count = await autoRateUnratedOrders()

    expect(count).toBe(0)
    expect(mockDb.testimonial.findMany).not.toHaveBeenCalled()
    expect(mockDb.testimonial.create).not.toHaveBeenCalled()
  })

  it('queries only paid orders confirmed more than 24h ago', async () => {
    mockDb.order.findMany.mockResolvedValueOnce([])

    await autoRateUnratedOrders()

    const call = mockDb.order.findMany.mock.calls[0][0]
    expect(call.where.status).toBe('paid')
    expect(call.where.confirmedAt.lt).toBeInstanceOf(Date)
    expect(call.where.confirmedAt.lt.getTime()).toBeLessThanOrEqual(Date.now() - 24 * 60 * 60 * 1000 + 1000)
  })
})
