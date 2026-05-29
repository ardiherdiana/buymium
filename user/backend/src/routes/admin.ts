import { Router, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../config/database'
import { requireAdmin } from '../middleware/auth'

const router = Router()

router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  const [totalProducts, totalOrders, paidOrders, pendingOrders, revenueAgg, totalUsers] = await Promise.all([
    db.product.count(),
    db.order.count(),
    db.order.count({ where: { status: 'paid' } }),
    db.order.count({ where: { status: 'pending' } }),
    db.order.aggregate({ where: { status: 'paid' }, _sum: { totalPrice: true } }),
    db.user.count({ where: { roleId: 2 } }),
  ])

  res.json({
    totalProducts,
    totalOrders,
    paidOrders,
    pendingOrders,
    revenue: revenueAgg._sum.totalPrice ?? 0,
    totalUsers,
  })
})

router.get('/orders', requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
  const limit = Math.min(100, parseInt(String(req.query.limit || '20')) || 20)
  const status = req.query.status as string | undefined

  const where: Prisma.OrderWhereInput = {}
  if (status) where.status = status

  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, title: true, section: { select: { title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  res.json({ data: orders, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
})

router.get('/orders/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const order = await db.order.findUnique({
    where: { id: parseInt(String(id)) },
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { 
        include: { 
          section: { select: { title: true } } 
        } 
      },
    },
  })

  if (!order) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan' })
    return
  }

  res.json(order)
})

router.get('/users', requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
  const limit = Math.min(100, parseInt(String(req.query.limit || '20')) || 20)
  const search = req.query.search as string | undefined

  const where: Prisma.UserWhereInput = {}
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ]
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        avatar: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  res.json({ data: users, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } })
})

router.patch('/users/:id/role', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const { roleId } = req.body

  if (roleId !== 1 && roleId !== 2) {
    res.status(400).json({ error: 'Role ID tidak valid' })
    return
  }

  try {
    await db.user.update({
      where: { id: parseInt(String(id)) },
      data: { roleId },
    })
    res.json({ message: 'Role berhasil diperbarui' })
  } catch {
    res.status(404).json({ error: 'User tidak ditemukan' })
  }
})

router.delete('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    await db.user.delete({ where: { id: parseInt(id) } })
    res.json({ message: 'User berhasil dihapus' })
  } catch {
    res.status(404).json({ error: 'User tidak ditemukan' })
  }
})

export default router
