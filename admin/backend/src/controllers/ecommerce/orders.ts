import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'
import { sendOrderConfirmed, sendOrderRejected } from '../../utils/email'
import { updateGoogleSheetsAfterSale } from '../../services/management/googleSheets/updateAfterSale'

type ItemToUpdate = {
  id: number
  email?: string | null
  username?: string | null
  phoneModel?: string | null
  year?: string | null
  sourceId?: number | null
  source?: { id: number; spreadsheetId?: string | null } | null
  isSold?: boolean
  capital?: number | null
}

// Matches the format the admin panel's manual POS sale flow generates client-side
// (see admin/frontend pos-page.tsx), so storefront and manual sales share one numbering scheme.
function generateSalesNumber(): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
  return `BUYMIUM${date}-${Date.now().toString().slice(-3)}`
}

// Fulfills an order whose product is backed by management inventory (Account/Accsmarket,
// linked via Product.sourceId) instead of the storefront Stock table: consumes the rows
// reserved at checkout, records a Sale/SaleLine (so it shows up in Finance > Sales), and
// remembers which rows were consumed on Order.inventoryRefs so the buyer can download them.
async function fulfillFromInventory(order: { id: number; quantity: number; totalPrice: number }, sourceId: number): Promise<ItemToUpdate[]> {
  const source = await db.source.findUnique({ where: { id: sourceId } })
  if (!source) return []

  const isAccsmarket = source.isAccsmarket
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table: any = isAccsmarket ? db.accsmarket : db.account

  const reserved = await table.findMany({
    where: { reservedOrderId: order.id },
    include: { source: true },
    take: order.quantity,
  })
  if (reserved.length === 0) return []

  const unitSalePrice = Math.floor(order.totalPrice / reserved.length)
  const totalCapital = reserved.reduce((s: number, row: { capital?: number | null }) => s + (row.capital ?? 0), 0)
  const totalProfit = order.totalPrice - totalCapital

  const sale = await db.sale.create({
    data: {
      salesNumber: generateSalesNumber(),
      orderId: order.id,
      sourceId,
      totalSalePrice: order.totalPrice,
      totalProfit,
    },
  })

  await db.$transaction(
    reserved.map((row: { id: number; capital?: number | null }) => {
      const profit = unitSalePrice - (row.capital ?? 0)
      return isAccsmarket
        ? db.saleLine.create({ data: { saleId: sale.id, accsmarketId: row.id, unitSalePrice, price: unitSalePrice, profit } })
        : db.saleLine.create({ data: { saleId: sale.id, accountId: row.id, unitSalePrice, price: unitSalePrice, profit } })
    })
  )

  await table.updateMany({
    where: { id: { in: reserved.map((r: { id: number }) => r.id) } },
    data: { isSold: true, reservedOrderId: null },
  })

  const inventoryRefs = (reserved as { id: number }[]).map((row) => ({ type: isAccsmarket ? 'accsmarket' : 'account', id: row.id }))
  await db.order.update({ where: { id: order.id }, data: { inventoryRefs: JSON.stringify(inventoryRefs) } })

  return reserved as ItemToUpdate[]
}

type InventoryRef = { type: 'account' | 'accsmarket'; id: number }

async function resolveInventoryRefs(inventoryRefsJson: string | null): Promise<unknown[]> {
  if (!inventoryRefsJson) return []
  let refs: InventoryRef[] = []
  try { refs = JSON.parse(inventoryRefsJson) } catch { return [] }

  const accountIds = refs.filter(r => r.type === 'account').map(r => r.id)
  const accsmarketIds = refs.filter(r => r.type === 'accsmarket').map(r => r.id)
  const [accounts, accsmarkets] = await Promise.all([
    accountIds.length ? db.account.findMany({ where: { id: { in: accountIds } } }) : [],
    accsmarketIds.length ? db.accsmarket.findMany({ where: { id: { in: accsmarketIds } } }) : [],
  ])
  return [
    ...accounts.map((a) => ({ ...a, isAccsmarket: false })),
    ...accsmarkets.map((a) => ({ ...a, isAccsmarket: true })),
  ]
}

async function resolveReservedInventory(orderId: number): Promise<unknown[]> {
  const [accounts, accsmarkets] = await Promise.all([
    db.account.findMany({ where: { reservedOrderId: orderId } }),
    db.accsmarket.findMany({ where: { reservedOrderId: orderId } }),
  ])
  return [
    ...accounts.map((a) => ({ ...a, isAccsmarket: false })),
    ...accsmarkets.map((a) => ({ ...a, isAccsmarket: true })),
  ]
}

export class OrdersController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
      const limit = Math.min(100, parseInt(String(req.query.limit || '20')) || 20)
      const status = req.query.status as string | undefined
      const search = req.query.search as string | undefined
      const userId = req.query.userId ? parseInt(String(req.query.userId)) : undefined

      const where: Prisma.OrderWhereInput = {}
      if (status) where.status = status
      if (userId) where.userId = userId
      if (search) {
        where.OR = [
          { groupId: { contains: search } },
          { user: { is: { name: { contains: search } } } },
          { user: { is: { email: { contains: search } } } },
        ]
      }

      const orders = await db.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, title: true, section: { select: { title: true } } } },
          bankAccount: { select: { id: true, bankName: true, accountNumber: true, accountHolder: true } },
        },
        orderBy: [{ groupId: 'asc' }, { id: 'asc' }],
      })

      // A single cart checkout creates one Order row per variant/product but shares one
      // groupId (see user/backend POST /orders/cart) - collapse those back into a single
      // list row so a buyer's multi-variant purchase reads as one order, not several.
      const groups = new Map<string, typeof orders>()
      for (const o of orders) {
        const key = o.groupId ?? `single-${o.id}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(o)
      }

      const merged = [...groups.values()]
        .map((items) => {
          const primary = items[0]
          return {
            id: primary.id,
            groupId: primary.groupId,
            user: primary.user,
            products: items.map((o) => o.product),
            itemCount: items.length,
            totalPrice: items.reduce((s, o) => s + o.totalPrice, 0),
            status: primary.status,
            bankAccount: primary.bankAccount,
            createdAt: items.reduce((latest, o) => new Date(o.createdAt) > new Date(latest) ? o.createdAt : latest, primary.createdAt),
          }
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      const total = merged.length
      const paged = merged.slice((page - 1) * limit, page * limit)

      res.json({
        data: paged,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      console.error('[Orders List Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch orders' })
    }
  }

  static async trend(req: Request, res: Response): Promise<void> {
    try {
      const localKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
      start.setHours(0, 0, 0, 0)

      const orders = await db.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true, status: true },
      })

      const counts = new Map<string, { total: number; paid: number }>()
      for (const o of orders) {
        const key = localKey(o.createdAt)
        const entry = counts.get(key) ?? { total: 0, paid: 0 }
        entry.total += 1
        if (o.status === 'paid') entry.paid += 1
        counts.set(key, entry)
      }

      const days: { date: string; total: number; paid: number }[] = []
      const cursor = new Date(start)
      while (cursor <= end) {
        const key = localKey(cursor)
        const entry = counts.get(key) ?? { total: 0, paid: 0 }
        days.push({ date: key, total: entry.total, paid: entry.paid })
        cursor.setDate(cursor.getDate() + 1)
      }

      res.json({ data: days, total: orders.length })
    } catch (err) {
      console.error('[Order Trend Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch order trend' })
    }
  }

  static async show(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const order = await db.order.findUnique({
        where: { id: parseInt(id) },
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { include: { section: { select: { title: true } } } },
          bankAccount: true,
        },
      })

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' })
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let relatedOrders: any[] = []
      if (order.groupId?.startsWith('BUYMIUM-CART-')) {
        relatedOrders = await db.order.findMany({
          where: { groupId: order.groupId },
          include: { product: { select: { id: true, title: true } } },
          orderBy: { id: 'asc' },
        })
      }

      // A cart checkout with multiple variants creates one Order row per variant,
      // each holding only its own slice of inventoryRefs - resolve credentials across
      // every order in the group, not just the one the admin happened to open.
      const ordersForInventory = relatedOrders.length > 0 ? relatedOrders : [order]
      const perOrderInventory = await Promise.all(
        ordersForInventory.map((o) =>
          o.inventoryRefs ? resolveInventoryRefs(o.inventoryRefs) : resolveReservedInventory(o.id)
        )
      )
      const inventoryItems = perOrderInventory.flat()

      // Derive each order's follower-tier label from its own resolved inventory rows
      // (e.g. "1.000+ Followers") so a multi-variant cart order shows which line is which.
      const variantLabels = await Promise.all(
        ordersForInventory.map(async (o, i) => {
          const items = perOrderInventory[i] as { targetFollowers?: number | null }[]
          const targetFollowers = items[0]?.targetFollowers ?? null
          if (targetFollowers === null) return null
          const variant = await db.productVariant.findFirst({ where: { productId: o.productId, targetFollowers } })
          return variant?.name ?? `${targetFollowers.toLocaleString('id-ID')}+ Followers`
        })
      )

      const relatedOrdersWithBreakdown = relatedOrders.map((o, i) => ({
        ...o,
        variantLabel: variantLabels[i],
        subtotal: o.totalPrice,
      }))
      const currentIndex = ordersForInventory.findIndex((o) => o.id === order.id)
      const orderVariantLabel = variantLabels[currentIndex] ?? null
      const orderBreakdown = relatedOrdersWithBreakdown.find((o) => o.id === order.id)
        ?? { subtotal: order.totalPrice }

      res.json({
        ...order,
        variantLabel: orderVariantLabel,
        subtotal: orderBreakdown.subtotal,
        relatedOrders: relatedOrdersWithBreakdown,
        inventoryItems,
      })
    } catch (err) {
      console.error('[Order Detail Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch order detail' })
    }
  }

  static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { status } = req.body

      const order = await db.order.update({
        where: { id: parseInt(id) },
        data: { status },
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, title: true } },
        },
      })

      res.json(order)
    } catch (err) {
      console.error('[Update Order Status Error]', err)
      res.status(500).json({ success: false, error: 'Failed to update order status' })
    }
  }

  static async confirm(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      const { adminNote } = req.body as { adminNote?: string }

      const order = await db.order.findUnique({ where: { id } })
      if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return }
      if (order.status === 'paid') { res.status(400).json({ success: false, error: 'Order sudah dikonfirmasi' }); return }

      const groupOrders = order.groupId
        ? await db.order.findMany({ where: { groupId: order.groupId } })
        : [order]

      const now = new Date()
      const sheetsItems: ItemToUpdate[] = []

      await Promise.all(
        groupOrders.map(async (o) => {
          if (o.status === 'paid') return

          await db.order.update({
            where: { id: o.id },
            data: { status: 'paid', confirmedAt: now, adminNote: adminNote ?? o.adminNote },
          })

          const product = await db.product.findUnique({ where: { id: o.productId }, select: { sourceId: true } })
          if (!product?.sourceId) {
            console.error(`[Confirm Order] Product ${o.productId} has no linked Source, cannot fulfill order ${o.id}`)
            return
          }

          const items = await fulfillFromInventory(o, product.sourceId)
          sheetsItems.push(...items)
        })
      )

      if (sheetsItems.length > 0) {
        updateGoogleSheetsAfterSale(sheetsItems).catch(err => console.error('[Confirm Order] Google Sheets update failed:', err))
      }

      const buyer = await db.user.findUnique({ where: { id: order.userId } })

      if (buyer?.email) {
        const totalAll = groupOrders.reduce((s, o) => s + o.totalPrice, 0)
        sendOrderConfirmed({
          to: buyer.email,
          name: buyer.name || 'Pelanggan',
          groupId: order.groupId || `#${order.id}`,
          totalPrice: totalAll,
          orderId: order.id,
        }).catch(() => {})
      }

      res.json({ message: 'Pesanan dikonfirmasi', orderId: id })
    } catch (err) {
      console.error('[Confirm Order Error]', err)
      res.status(500).json({ success: false, error: 'Failed to confirm order' })
    }
  }

  static async reject(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      const { adminNote } = req.body as { adminNote: string }

      const order = await db.order.findUnique({ where: { id } })
      if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return }
      if (order.status === 'paid') { res.status(400).json({ success: false, error: 'Tidak bisa menolak order yang sudah lunas' }); return }

      const groupOrders = order.groupId
        ? await db.order.findMany({ where: { groupId: order.groupId } })
        : [order]

      await Promise.all(groupOrders.map(o =>
        db.order.update({ where: { id: o.id }, data: { status: 'cancelled', adminNote } })
      ))

      const groupOrderIds = groupOrders.map(o => o.id)
      await db.account.updateMany({ where: { reservedOrderId: { in: groupOrderIds } }, data: { reservedOrderId: null } })
      await db.accsmarket.updateMany({ where: { reservedOrderId: { in: groupOrderIds } }, data: { reservedOrderId: null } })

      const buyer = await db.user.findUnique({ where: { id: order.userId } })
      if (buyer?.email) {
        sendOrderRejected({
          to: buyer.email,
          name: buyer.name || 'Pelanggan',
          groupId: order.groupId || `#${order.id}`,
          reason: adminNote || 'Bukti tidak valid. Mohon upload ulang.',
          orderId: order.id,
        }).catch(() => {})
      }

      res.json({ message: 'Pesanan ditolak', orderId: id })
    } catch (err) {
      console.error('[Reject Order Error]', err)
      res.status(500).json({ success: false, error: 'Failed to reject order' })
    }
  }

  static async destroy(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)

      const order = await db.order.findUnique({ where: { id } })
      if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return }

      await db.account.updateMany({ where: { reservedOrderId: id }, data: { reservedOrderId: null } })
      await db.accsmarket.updateMany({ where: { reservedOrderId: id }, data: { reservedOrderId: null } })
      await db.order.delete({ where: { id } })

      res.json({ message: 'Order deleted successfully' })
    } catch (err) {
      console.error('[Delete Order Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete order' })
    }
  }
}
