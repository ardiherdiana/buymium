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
          sourceId,
          isSold: false,
          accountStatus: { in: DONE_STATUSES },
          reservedOrderId: null,
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
      sourceId,
      isSold: false,
      accountStatus: { in: DONE_STATUSES },
      reservedOrderId: null,
      ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
    },
  })
}

export async function listInventoryPreview(productId: number, sourceId: number) {
  const t = await table(sourceId)
  if (!t) return []
  const targetFollowers = await activeTargetFollowers(productId)
  return t.findMany({
    where: {
      sourceId,
      isSold: false,
      accountStatus: { in: DONE_STATUSES },
      reservedOrderId: null,
      ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
    },
    select: { id: true, username: true, email: true, targetFollowers: true },
    orderBy: { id: 'asc' },
  })
}

export async function reserveInventory(orderId: number, productId: number, sourceId: number, quantity: number, variantId?: number): Promise<void> {
  const t = await table(sourceId)
  if (!t) return
  const targetFollowers = await resolveTierFilter(productId, variantId)
  if (targetFollowers?.length === 0) return
  const rows = await t.findMany({
    where: {
      sourceId,
      isSold: false,
      accountStatus: { in: DONE_STATUSES },
      reservedOrderId: null,
      ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: quantity,
  })
  if (rows.length === 0) return
  await t.updateMany({
    where: { id: { in: rows.map((r: { id: number }) => r.id) } },
    data: { reservedOrderId: orderId },
  })
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
