import { Prisma, PrismaClient } from '@prisma/client'
import db from '../config/database'

type DbClient = PrismaClient | Prisma.TransactionClient

const DONE_STATUSES = ['Completed', 'completed']

function eligibilityWhere(sourceId: number): Record<string, unknown> {
  return {
    sourceId,
    isSold: false,
    accountStatus: { in: DONE_STATUSES },
    reservedOrderId: null,
  }
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
  const variants = await db.productVariant.findMany({
    where: { productId, isActive: true },
    orderBy: { targetFollowers: 'asc' },
  })

  const where = eligibilityWhere(sourceId)
  return Promise.all(
    variants.map(async (v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      targetFollowers: v.targetFollowers,
      availableStock: await db.account.count({
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
  const targetFollowers = await resolveTierFilter(productId, variantId)
  if (targetFollowers?.length === 0) return 0
  return db.account.count({
    where: {
      ...eligibilityWhere(sourceId),
      ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
    },
  })
}

export async function listInventoryPreview(productId: number, sourceId: number) {
  const targetFollowers = await activeTargetFollowers(productId)
  return db.account.findMany({
    where: {
      ...eligibilityWhere(sourceId),
      ...(targetFollowers ? { targetFollowers: { in: targetFollowers } } : {}),
    },
    select: { id: true, username: true, email: true, targetFollowers: true },
    orderBy: { id: 'asc' },
  })
}

/**
 * Reserves inventory rows for an order. Pass `client` (a Prisma transaction client) to
 * run this as part of a caller-owned transaction — e.g. wrapping order.create + this
 * reservation atomically, so a mid-flight crash can't leave an unreserved "ghost" order.
 * Without `client`, it opens its own transaction (backwards-compatible standalone use).
 */
export async function reserveInventory(orderId: number, productId: number, sourceId: number, quantity: number, variantId?: number, stockIds?: number[], client?: DbClient): Promise<number> {
  const targetFollowers = await resolveTierFilter(productId, variantId)
  if (targetFollowers?.length === 0) return 0

  const tierClause = targetFollowers
    ? Prisma.sql`AND target_followers IN (${Prisma.join(targetFollowers)})`
    : Prisma.empty
  const idsClause = stockIds && stockIds.length > 0
    ? Prisma.sql`AND id IN (${Prisma.join(stockIds.map((id) => Number(id)))})`
    : Prisma.empty

  const run = async (tx: DbClient): Promise<number> => {
    const rows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM accounts
      WHERE source_id = ${sourceId}
        AND is_sold = 0
        AND account_status IN (${Prisma.join(DONE_STATUSES)})
        AND reserved_order_id IS NULL
        ${idsClause}
        ${tierClause}
      ORDER BY id ASC
      LIMIT ${quantity}
      FOR UPDATE
    `
    if (rows.length === 0) return 0
    const ids = rows.map((r) => r.id)
    const updated = await tx.$executeRaw`
      UPDATE accounts SET reserved_order_id = ${orderId}
      WHERE id IN (${Prisma.join(ids)}) AND reserved_order_id IS NULL
    `
    return Number(updated)
  }

  return client ? run(client) : db.$transaction((tx) => run(tx))
}

export async function getOrderVariantLabel(
  orderId: number,
  productId: number,
  sourceId: number | null,
  inventoryRefsJson: string | null
): Promise<string | null> {
  if (!sourceId) return null

  let targetFollowers: number | null = null

  if (inventoryRefsJson) {
    try {
      const refs = JSON.parse(inventoryRefsJson) as { id: number }[]
      if (refs.length > 0) {
        const row = await db.account.findUnique({ where: { id: refs[0].id }, select: { targetFollowers: true } })
        targetFollowers = row?.targetFollowers ?? null
      }
    } catch {
      targetFollowers = null
    }
  }

  if (targetFollowers === null) {
    const row = await db.account.findFirst({ where: { reservedOrderId: orderId }, select: { targetFollowers: true } })
    targetFollowers = row?.targetFollowers ?? null
  }

  if (targetFollowers === null) return null

  const variant = await db.productVariant.findFirst({ where: { productId, targetFollowers } })
  return variant?.name ?? `${targetFollowers.toLocaleString('id-ID')}+ Followers`
}

export async function releaseInventory(orderIds: number[], client?: DbClient): Promise<void> {
  if (orderIds.length === 0) return
  const conn = client ?? db
  const run = async (tx: DbClient) => {
    await tx.account.updateMany({
      where: { reservedOrderId: { in: orderIds } },
      data: { reservedOrderId: null },
    })
  }
  if (client) await run(conn)
  else await db.$transaction((tx) => run(tx))
}
