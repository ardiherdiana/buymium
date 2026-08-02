import { Request, Response } from 'express'
import db from '../../config/database'
import { logger } from '../../utils/logger'

export class StatsController {
  static async index(_req: Request, res: Response): Promise<void> {
    try {
      const [
        totalProducts,
        totalOrders,
        paidOrders,
        pendingOrders,
        revenueAgg,
        totalUsers,
        recentOrders,
      ] = await Promise.all([
        db.product.count(),
        db.order.count(),
        db.order.count({ where: { status: 'paid' } }),
        db.order.count({ where: { status: 'pending' } }),
        db.order.aggregate({ where: { status: 'paid' }, _sum: { totalPrice: true } }),
        db.user.count({ where: { roleId: 2 } }),
        db.order.findMany({
          where: { status: 'paid' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            user: { select: { id: true, name: true, email: true } },
            product: { select: { id: true, title: true } },
          },
        }),
      ])

      res.json({
        totalProducts,
        totalOrders,
        paidOrders,
        pendingOrders,
        revenue: revenueAgg._sum.totalPrice ?? 0,
        totalUsers,
        recentPaidOrders: recentOrders,
      })
    } catch (err) {
      logger.error('[Stats Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch statistics' })
    }
  }

  static async orders(_req: Request, res: Response): Promise<void> {
    try {
      const [paid, pending, failed, cancelled] = await Promise.all([
        db.order.count({ where: { status: 'paid' } }),
        db.order.count({ where: { status: 'pending' } }),
        db.order.count({ where: { status: 'failed' } }),
        db.order.count({ where: { status: 'cancelled' } }),
      ])

      res.json({
        paid,
        pending,
        failed,
        cancelled,
        total: paid + pending + failed + cancelled,
      })
    } catch (err) {
      logger.error('[Order Stats Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch order statistics' })
    }
  }

  static async revenue(_req: Request, res: Response): Promise<void> {
    try {
      const totalRevenue = await db.order.aggregate({
        where: { status: 'paid' },
        _sum: { totalPrice: true },
      })

      const monthlyRevenue = await db.order.groupBy({
        by: ['createdAt'],
        where: { status: 'paid' },
        _sum: { totalPrice: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })

      res.json({
        total: totalRevenue._sum.totalPrice ?? 0,
        monthly: monthlyRevenue,
      })
    } catch (err) {
      logger.error('[Revenue Stats Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch revenue statistics' })
    }
  }
}
