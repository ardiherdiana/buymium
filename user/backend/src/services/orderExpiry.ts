import db from '../config/database'
import { releaseInventory } from '../utils/inventory'

const CHECK_INTERVAL_MS = 60 * 60 * 1000
const EXPIRY_MS = 24 * 60 * 60 * 1000

export async function expirePendingOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - EXPIRY_MS)
  const expired = await db.order.findMany({
    where: { status: 'pending', createdAt: { lt: cutoff } },
    select: { id: true },
  })
  if (expired.length === 0) return 0

  const ids = expired.map((o) => o.id)
  await db.order.updateMany({ where: { id: { in: ids } }, data: { status: 'cancelled' } })
  await releaseInventory(ids)
  return ids.length
}

export function startOrderExpiryJob(): void {
  setInterval(() => {
    expirePendingOrders().catch((err) => console.error('[OrderExpiry] failed', err))
  }, CHECK_INTERVAL_MS)
}
