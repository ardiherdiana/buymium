import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'

export class UsersController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
      const limit = Math.min(100, parseInt(String(req.query.limit || '20')) || 20)
      const search = req.query.search as string | undefined

      const where: Prisma.UserWhereInput = { roleId: 2 }
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
        ]
      }

      // Prisma cannot ORDER BY an aggregate in findMany, so we sort in JS.
      // This is acceptable because roleId=2 buyers are a bounded set.
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
            _count: { select: { orders: true } },
            orders: {
              where: { status: 'paid' },
              select: { totalPrice: true },
            },
          },
        }),
      ])

      const usersWithStats = users
        .map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          roleId: u.roleId,
          avatar: u.avatar,
          createdAt: u.createdAt,
          orderCount: u._count.orders,
          totalSpent: u.orders.reduce((sum, o) => sum + o.totalPrice, 0),
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)

      const paginated = usersWithStats.slice((page - 1) * limit, page * limit)

      res.json({
        data: paginated,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      console.error('[Users List Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch users' })
    }
  }

  static async show(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const user = await db.user.findUnique({
        where: { id: parseInt(id) },
        select: {
          id: true,
          name: true,
          email: true,
          roleId: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' })
        return
      }

      res.json(user)
    } catch (err) {
      console.error('[User Detail Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch user detail' })
    }
  }

  static async updateRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { roleId } = req.body

      const user = await db.user.update({
        where: { id: parseInt(id) },
        data: { roleId },
        select: { id: true, name: true, email: true, roleId: true },
      })

      res.json(user)
    } catch (err) {
      console.error('[Update Role Error]', err)
      res.status(500).json({ success: false, error: 'Failed to update user role' })
    }
  }

  static async destroy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      await db.user.delete({
        where: { id: parseInt(id) },
      })

      res.json({ message: 'User deleted successfully' })
    } catch (err) {
      console.error('[Delete User Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete user' })
    }
  }
}
