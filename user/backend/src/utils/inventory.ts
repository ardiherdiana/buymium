import { Prisma } from '@prisma/client'
import db from '../config/database'

const DONE_STATUSES = ['Completed', 'completed']

type SourceRow = { id: number; isAccsmarket: boolean }

async function getSource(sourceId: number): Promise<SourceRow | null> {
  return db.source.findUnique({ where: { id: sourceId } })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tableFor(source: SourceRow): any {
  return source.isAccsmarket ? db.accsmarket : db.account
}

function eligibilityWhere(source: SourceRow): Record<string, unknown> {
  const base: Record<string, unknown> = {
    sourceId: source.id,
    isSold: false,
    accountStatus: { in: DONE_STATUSES },
    reservedOrderId: null,
  }
  if (source.isAccsmarket) {
    const cutoffYear = new Date().getFullYear() - 2
    base.year = { lte: String(cutoffYear) }
  }
  return base
}

async function activeTargetFollowers(productId: number): Promise<number[] | null> {
  const variants = await db.productVariant.findMany({
    where: { productId, isActive: true },
    select: { targetFollowers: true },
  })
  if (variants.length === 0) return null
  return variants.map((v) => v.targetFollowers).filter((v): v is number => v !== null)
}

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

export async function getProductVariants(productId: number, sourceId: number): Promise<VariantWithStock[]> {
  const source = await getSource(sourceId)
  const variants = await db.productVariant.findMany({
    where: { productId, isActive: true },
    orderBy: { targetFollowers: 'asc' },
  })
  if (!source) return variants.map((v) => ({ id: v.id, name: v.name, price: v.price, targetFollowers: v.targetFollowers, availableStock: 0 }))

  const t = tableFor(source)
  const where = eligibilityWhere(source)
  return Promise.all(
    variants.map(async (v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      targetFollowers: v.targetFollowers,
      availableStock: await t.count({
        where: { ...where, targetFollowers: v.targetFollowers },
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
  const source = await getSource(sourceId)
  if (!source) return 0
  const targetFollowers = await resolveTierFilter(productId, variantId)
  if (targetFollowers?.length === 0) return 0
  return tableFor(source).count({
    where: {
      ...eligibilityWhere(source),
      ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
    },
  })
}

export async function listInventoryPreview(productId: number, sourceId: number) {
  const source = await getSource(sourceId)
  if (!source) return []
  const targetFollowers = await activeTargetFollowers(productId)
  return tableFor(source).findMany({
    where: {
      ...eligibilityWhere(source),
      ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
    },
    select: { id: true, username: true, email: true, targetFollowers: true, ...(source.isAccsmarket ? { year: true } : {}) },
    orderBy: { id: 'asc' },
  })
}

export async function reserveInventory(orderId: number, productId: number, sourceId: number, quantity: number, variantId?: number, stockIds?: number[]): Promise<number> {
  const source = await db.source.findUnique({ where: { id: sourceId } })
  if (!source) return 0
  const targetFollowers = await resolveTierFilter(productId, variantId)
  if (targetFollowers?.length === 0) return 0

  const tableIdentifier = Prisma.raw(source.isAccsmarket ? 'accsmarkets' : 'accounts')

  const yearClause = source.isAccsmarket
    ? Prisma.sql`AND year <= ${String(new Date().getFullYear() - 2)}`
    : Prisma.empty
  const tierClause = targetFollowers
    ? Prisma.sql`AND target_followers IN (${Prisma.join(targetFollowers)})`
    : Prisma.empty
  const idsClause = stockIds && stockIds.length > 0
    ? Prisma.sql`AND id IN (${Prisma.join(stockIds.map((id) => Number(id)))})`
    : Prisma.empty

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM ${tableIdentifier}
      WHERE source_id = ${sourceId}
        AND is_sold = 0
        AND account_status IN (${Prisma.join(DONE_STATUSES)})
        AND reserved_order_id IS NULL
        ${idsClause}
        ${tierClause}
        ${yearClause}
      ORDER BY id ASC
      LIMIT ${quantity}
      FOR UPDATE
    `
    if (rows.length === 0) return 0
    const ids = rows.map((r) => r.id)
    const updated = await tx.$executeRaw`
      UPDATE ${tableIdentifier} SET reserved_order_id = ${orderId}
      WHERE id IN (${Prisma.join(ids)}) AND reserved_order_id IS NULL
    `
    return Number(updated)
  })
}

export async function getOrderVariantLabel(
  orderId: number,
  productId: number,
  sourceId: number | null,
  inventoryRefsJson: string | null
): Promise<string | null> {
  if (!sourceId) return null
  const source = await getSource(sourceId)
  if (!source) return null
  const t = tableFor(source)

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
