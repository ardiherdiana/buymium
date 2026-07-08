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

  const sale = await db.sale.create({
    data: {
      salesNumber: `SO-${order.id}`,
      orderId: order.id,
      sourceId,
      totalSalePrice: order.totalPrice,
      totalProfit: 0,
    },
  })

  await db.$transaction(
    reserved.map((row: { id: number }) =>
      isAccsmarket
        ? db.saleLine.create({ data: { saleId: sale.id, accsmarketId: row.id, unitSalePrice: 0, price: 0, profit: 0 } })
        : db.saleLine.create({ data: { saleId: sale.id, accountId: row.id, unitSalePrice: 0, price: 0, profit: 0 } })
    )
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
  return [...accounts, ...accsmarkets]
}

export class OrdersController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
      const limit = Math.min(100, parseInt(String(req.query.limit || '20')) || 20)
      const status = req.query.status as string | undefined
      const search = req.query.search as string | undefined

      const where: Prisma.OrderWhereInput = {}
      if (status) where.status = status
      if (search) {
        where.OR = [
          { groupId: { contains: search } },
          { user: { is: { name: { contains: search } } } },
          { user: { is: { email: { contains: search } } } },
        ]
      }

      const [total, orders] = await Promise.all([
        db.order.count({ where }),
        db.order.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true } },
            product: { select: { id: true, title: true, section: { select: { title: true } } } },
            bankAccount: { select: { id: true, bankName: true, accountNumber: true, accountHolder: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ])

      res.json({
        data: orders,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      console.error('[Orders List Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch orders' })
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

      let relatedOrders: unknown[] = []
      if (order.groupId?.startsWith('BUYMIUM-CART-')) {
        relatedOrders = await db.order.findMany({
          where: { groupId: order.groupId },
          include: { product: { select: { id: true, title: true } } },
          orderBy: { id: 'asc' },
        })
      }

      const inventoryItems = await resolveInventoryRefs(order.inventoryRefs)

      res.json({ ...order, relatedOrders, inventoryItems })
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
