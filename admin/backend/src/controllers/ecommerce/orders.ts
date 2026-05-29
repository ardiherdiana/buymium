import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'
import { sendOrderConfirmed, sendOrderRejected } from '../../utils/email'

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
          stocks: true,
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

      res.json({ ...order, relatedOrders })
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

      await Promise.all(
        groupOrders.map(async (o) => {
          if (o.status === 'paid') return

          await db.order.update({
            where: { id: o.id },
            data: { status: 'paid', confirmedAt: now, adminNote: adminNote ?? o.adminNote },
          })

          await db.product.update({
            where: { id: o.productId },
            data: { inStock: { decrement: o.quantity } },
          })

          const reserved = await db.stock.findMany({
            where: { orderId: o.id, status: 'reserved' },
            take: o.quantity,
          })

          if (reserved.length >= o.quantity) {
            await db.stock.updateMany({
              where: { id: { in: reserved.map(s => s.id) } },
              data: { status: 'sold' },
            })
          } else {
            if (reserved.length > 0) {
              await db.stock.updateMany({
                where: { id: { in: reserved.map(s => s.id) } },
                data: { status: 'available', orderId: null },
              })
            }
            const available = await db.stock.findMany({
              where: { productId: o.productId, status: 'available' },
              take: o.quantity,
            })
            if (available.length >= o.quantity) {
              await db.stock.updateMany({
                where: { id: { in: available.map(s => s.id) } },
                data: { status: 'sold', orderId: o.id },
              })
            }
          }
        })
      )

      const buyer = await db.user.findUnique({ where: { id: order.userId } })

      if (buyer?.referredById) {
        const totalAll = groupOrders.reduce((s, o) => s + o.totalPrice, 0)
        const commission = Math.round(totalAll * 0.05)
        await db.user.update({
          where: { id: buyer.referredById },
          data: { referralBalance: { increment: commission } },
        })
      }

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

      await db.stock.updateMany({
        where: { orderId: { in: groupOrders.map(o => o.id) }, status: 'reserved' },
        data: { status: 'available', orderId: null },
      })

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

      await db.stock.updateMany({
        where: { orderId: id, status: 'reserved' },
        data: { status: 'available', orderId: null },
      })
      await db.stock.updateMany({ where: { orderId: id }, data: { orderId: null } })
      await db.order.delete({ where: { id } })

      res.json({ message: 'Order deleted successfully' })
    } catch (err) {
      console.error('[Delete Order Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete order' })
    }
  }
}
