import db from '../config/database'

// A Product with `sourceId` set draws its stock from the admin-managed
// `Account`/`Accsmarket` tables (synced from Google Sheets) instead of `Stock`.
// Which table depends on `Source.isAccsmarket`.

// The "done" account status is stored inconsistently across Account ("Completed") and
// Accsmarket ("completed") rows - match both casings rather than relying on one.
const DONE_STATUSES = ['Completed', 'completed']

// Account and Accsmarket are structurally identical for our purposes (sourceId,
// isSold, accountStatus, reservedOrderId) but Prisma generates distinct delegate
// types per model, so the union can't be called directly - hence the `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function table(sourceId: number): Promise<any> {
  const source = await db.source.findUnique({ where: { id: sourceId } })
  if (!source) return null
  return source.isAccsmarket ? db.accsmarket : db.account
}

// Accsmarket-backed sources (isAccsmarket) additionally require the account to be
// at least 2 years old (Account has no `year` field, so this only applies to Accsmarket).
async function eligibilityWhere(sourceId: number): Promise<Record<string, unknown>> {
  const source = await db.source.findUnique({ where: { id: sourceId } })
  const base: Record<string, unknown> = {
    sourceId,
    isSold: false,
    accountStatus: { in: DONE_STATUSES },
    reservedOrderId: null,
  }
  if (source?.isAccsmarket) {
    const cutoffYear = new Date().getFullYear() - 2
    base.year = { lte: String(cutoffYear) }
  }
  return base
}

// If the product has active price-tier variants, only accounts matching one of those
// follower tiers count as sellable stock - a source can have accounts (e.g. 5k/10k
// followers) that were never turned into a priced opsi and shouldn't be sold/counted.
async function activeTargetFollowers(productId: number): Promise<number[] | null> {
  const variants = await db.productVariant.findMany({
    where: { productId, isActive: true },
    select: { targetFollowers: true },
  })
  if (variants.length === 0) return null
  return variants.map((v) => v.targetFollowers).filter((v): v is number => v !== null)
}

// Resolves which specific follower tier(s) a query should be scoped to: a chosen
// variantId scopes to just that tier's targetFollowers (so price and stock delivered
// always match what the buyer picked); no variantId falls back to every active tier.
async function resolveTierFilter(productId: number, variantId?: number): Promise<number[] | null> {
  if (variantId) {
    const variant = await db.productVariant.findUnique({ where: { id: variantId } })
    if (!variant || variant.productId !== productId || !variant.isActive) return []
    return variant.targetFollowers !== null ? [variant.targetFollowers] : []
  }
  return activeTargetFollowers(productId)
}

export async function isSourceLinked(productId: number): Promise<number | null> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { sourceId: true } })
  return product?.sourceId ?? null
}

export interface VariantWithStock {
  id: number
  name: string
  price: number
  targetFollowers: number | null
  availableStock: number
}

// Full price-tier list for a product, each with its live available-stock count -
// powers the storefront's follower-tier tabs and price range display.
export async function getProductVariants(productId: number, sourceId: number): Promise<VariantWithStock[]> {
  const t = await table(sourceId)
  const variants = await db.productVariant.findMany({
    where: { productId, isActive: true },
    orderBy: { targetFollowers: 'asc' },
  })
  if (!t) return variants.map((v) => ({ id: v.id, name: v.name, price: v.price, targetFollowers: v.targetFollowers, availableStock: 0 }))

  return Promise.all(
    variants.map(async (v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      targetFollowers: v.targetFollowers,
      availableStock: await t.count({
        where: {
          ...(await eligibilityWhere(sourceId)),
          targetFollowers: v.targetFollowers,
        },
      }),
    }))
  )
}

export async function getVariantPrice(productId: number, variantId: number): Promise<number | null> {
  const variant = await db.productVariant.findUnique({ where: { id: variantId } })
  if (!variant || variant.productId !== productId || !variant.isActive) return null
  return variant.price
}

export async function countAvailableInventory(productId: number, sourceId: number, variantId?: number): Promise<number> {
  const t = await table(sourceId)
  if (!t) return 0
  const targetFollowers = await resolveTierFilter(productId, variantId)
  if (targetFollowers?.length === 0) return 0
  return t.count({
    where: {
      ...(await eligibilityWhere(sourceId)),
      ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
    },
  })
}

export async function listInventoryPreview(productId: number, sourceId: number) {
  const t = await table(sourceId)
  if (!t) return []
  const source = await db.source.findUnique({ where: { id: sourceId } })
  const targetFollowers = await activeTargetFollowers(productId)
  return t.findMany({
    where: {
      ...(await eligibilityWhere(sourceId)),
      ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
    },
    select: { id: true, username: true, email: true, targetFollowers: true, ...(source?.isAccsmarket ? { year: true } : {}) },
    orderBy: { id: 'asc' },
  })
}

export async function reserveInventory(orderId: number, productId: number, sourceId: number, quantity: number, variantId?: number, stockIds?: number[]): Promise<void> {
  const t = await table(sourceId)
  if (!t) return
  const targetFollowers = await resolveTierFilter(productId, variantId)
  if (targetFollowers?.length === 0) return

  const baseWhere = {
    ...(await eligibilityWhere(sourceId)),
    ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
  }

  // Buyer picked specific accounts from the preview list - reserve exactly those
  // (still re-checked against availability/tier) instead of the first N available.
  const rows = stockIds && stockIds.length > 0
    ? await t.findMany({ where: { ...baseWhere, id: { in: stockIds } }, select: { id: true }, take: quantity })
    : await t.findMany({ where: baseWhere, select: { id: true }, orderBy: { id: 'asc' }, take: quantity })

  if (rows.length === 0) return
  await t.updateMany({
    where: { id: { in: rows.map((r: { id: number }) => r.id) } },
    data: { reservedOrderId: orderId },
  })
}

// Resolves which follower-tier the buyer actually received for an order, so the
// order detail page can show e.g. "1.000+ Followers" instead of just a quantity.
// Looks at the fulfilled inventoryRefs first (paid orders), falling back to the
// still-reserved rows (pending/awaiting_confirmation orders that haven't been fulfilled yet).
export async function getOrderVariantLabel(
  orderId: number,
  productId: number,
  sourceId: number | null,
  inventoryRefsJson: string | null
): Promise<string | null> {
  if (!sourceId) return null
  const t = await table(sourceId)
  if (!t) return null

  let targetFollowers: number | null = null

  if (inventoryRefsJson) {
    try {
      const refs = JSON.parse(inventoryRefsJson) as { type: string; id: number }[]
      if (refs.length > 0) {
        const row = await t.findUnique({ where: { id: refs[0].id }, select: { targetFollowers: true } })
        targetFollowers = row?.targetFollowers ?? null
      }
    } catch {
      targetFollowers = null
    }
  }

  if (targetFollowers === null) {
    const row = await t.findFirst({ where: { reservedOrderId: orderId }, select: { targetFollowers: true } })
    targetFollowers = row?.targetFollowers ?? null
  }

  if (targetFollowers === null) return null

  const variant = await db.productVariant.findFirst({ where: { productId, targetFollowers } })
  return variant?.name ?? `${targetFollowers.toLocaleString('id-ID')}+ Followers`
}

export async function releaseInventory(orderIds: number[]): Promise<void> {
  if (orderIds.length === 0) return
  await db.account.updateMany({
    where: { reservedOrderId: { in: orderIds } },
    data: { reservedOrderId: null },
  })
  await db.accsmarket.updateMany({
    where: { reservedOrderId: { in: orderIds } },
    data: { reservedOrderId: null },
  })
}
