import db from '../config/database'

const CHECK_INTERVAL_MS = 60 * 60 * 1000
const RATING_DELAY_MS = 24 * 60 * 60 * 1000

// Orders left unrated 24h after payment silently get a 5-star testimonial filled in
// on the buyer's behalf - keeps the public testimonial feed active. The frontend never
// mentions this happens (no "rate within 24h" messaging anywhere). No review text is
// generated - `message` is left blank since there's nothing genuine to attribute to the buyer.
const AUTO_RATING_MESSAGE = ''

export async function autoRateUnratedOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - RATING_DELAY_MS)
  const candidates = await db.order.findMany({
    where: { status: 'paid', confirmedAt: { lt: cutoff } },
    select: { id: true, userId: true, productId: true, user: { select: { name: true } } },
  })
  if (candidates.length === 0) return 0

  const rated = await db.testimonial.findMany({
    where: { orderId: { in: candidates.map((o) => o.id) } },
    select: { orderId: true },
  })
  const ratedIds = new Set(rated.map((r) => r.orderId))
  const unrated = candidates.filter((o) => !ratedIds.has(o.id))
  if (unrated.length === 0) return 0

  for (const order of unrated) {
    try {
      await db.testimonial.create({
        data: {
          productId: order.productId,
          createdById: order.userId,
          orderId: order.id,
          customerName: order.user.name || 'Pelanggan',
          message: AUTO_RATING_MESSAGE,
          rating: 5,
          isPublished: true,
        },
      })
    } catch (err) {
      console.error(`[AutoRating] failed to rate order #${order.id}`, err)
    }
  }

  return unrated.length
}

export function startAutoRatingJob(): void {
  setInterval(() => {
    autoRateUnratedOrders().catch((err) => console.error('[AutoRating] failed', err))
  }, CHECK_INTERVAL_MS)
}
