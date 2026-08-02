import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDb } from '../setup'
import { reserveInventory, releaseInventory } from '../../utils/inventory'

describe('reserveInventory', () => {
  beforeEach(() => {
    mockDb.productVariant.findMany.mockResolvedValue([])
  })

  it('reserves available stock and returns the number of rows reserved', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }])
    mockDb.$executeRaw.mockResolvedValue(3)

    const reserved = await reserveInventory(100, 1, 1, 3)

    expect(reserved).toBe(3)
    expect(mockDb.$transaction).toHaveBeenCalled()
    expect(mockDb.$queryRaw).toHaveBeenCalled()
    expect(mockDb.$executeRaw).toHaveBeenCalled()
  })

  it('returns 0 (no throw) when insufficient/no stock rows are found', async () => {
    mockDb.$queryRaw.mockResolvedValue([])

    const reserved = await reserveInventory(100, 1, 1, 5)

    expect(reserved).toBe(0)
    expect(mockDb.$executeRaw).not.toHaveBeenCalled()
  })

  it('returns the count actually updated when fewer rows than selected got claimed (race)', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: 10 }, { id: 11 }])
    mockDb.$executeRaw.mockResolvedValue(1) // another tx grabbed one first

    const reserved = await reserveInventory(100, 1, 1, 2)

    expect(reserved).toBe(1)
  })

  it('filters by the given source id', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: 20 }])
    mockDb.$executeRaw.mockResolvedValue(1)

    const reserved = await reserveInventory(100, 1, 2, 1)

    expect(reserved).toBe(1)
    const rawCallArgs = mockDb.$queryRaw.mock.calls[0]
    expect(JSON.stringify(rawCallArgs)).toContain('source_id')
  })

  it('opens its own transaction ($transaction) when no client is passed', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ id: 1 }])
    mockDb.$executeRaw.mockResolvedValue(1)

    await reserveInventory(100, 1, 1, 1)

    expect(mockDb.$transaction).toHaveBeenCalledTimes(1)
  })

  it('respects a passed-in transaction client instead of opening its own', async () => {
    const txClient = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 1 }]),
      $executeRaw: vi.fn().mockResolvedValue(1),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const reserved = await reserveInventory(100, 1, 1, 1, undefined, undefined, txClient)

    expect(reserved).toBe(1)
    expect(txClient.$queryRaw).toHaveBeenCalled()
    expect(txClient.$executeRaw).toHaveBeenCalled()
    // db-level transaction must NOT be used when a client is provided
    expect(mockDb.$transaction).not.toHaveBeenCalled()
    expect(mockDb.$queryRaw).not.toHaveBeenCalled()
  })

  it('returns 0 without querying when a variantId resolves to an empty tier filter', async () => {
    mockDb.productVariant.findUnique.mockResolvedValue({
      id: 5,
      productId: 999, // mismatched productId -> resolveTierFilter returns []
      isActive: true,
      targetFollowers: 1000,
    })

    const reserved = await reserveInventory(100, 1, 1, 2, 5)

    expect(reserved).toBe(0)
    expect(mockDb.$queryRaw).not.toHaveBeenCalled()
  })
})

describe('releaseInventory', () => {
  it('does nothing when orderIds is empty', async () => {
    await releaseInventory([])
    expect(mockDb.$transaction).not.toHaveBeenCalled()
    expect(mockDb.account.updateMany).not.toHaveBeenCalled()
  })

  it('releases reserved rows in the account table', async () => {
    mockDb.account.updateMany.mockResolvedValue({ count: 2 })

    await releaseInventory([100, 101])

    expect(mockDb.account.updateMany).toHaveBeenCalledWith({
      where: { reservedOrderId: { in: [100, 101] } },
      data: { reservedOrderId: null },
    })
  })

  it('wraps the updateMany call in a single $transaction when no client is passed', async () => {
    mockDb.account.updateMany.mockResolvedValue({ count: 1 })

    await releaseInventory([100])

    expect(mockDb.$transaction).toHaveBeenCalledTimes(1)
  })

  it('uses the passed-in transaction client directly without opening a new transaction', async () => {
    const txClient = {
      account: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    await releaseInventory([100], txClient)

    expect(txClient.account.updateMany).toHaveBeenCalled()
    expect(mockDb.$transaction).not.toHaveBeenCalled()
    expect(mockDb.account.updateMany).not.toHaveBeenCalled()
  })
})
