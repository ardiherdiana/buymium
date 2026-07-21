import express, { Request, Response } from 'express'
import { requireAdmin, requireSuperAdmin } from '../middleware/auth'
import prisma from '../config/database'
import { validate } from '../middleware/validate'
import { UpdateUserRoleByNameSchema } from '../validators/auth'

const router = express.Router()

// GET all roles (for reference)
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      select: { id: true, name: true, description: true, permissions: true },
    })
    res.json(roles)
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch roles' })
  }
})

// GET all users with their roles (Admin access)
router.get('/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, parseInt(req.query.limit as string) || 10)
    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        include: { role: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ])

    const usersWithRoles = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name,
      permissions: user.role.permissions,
      createdAt: user.createdAt,
    }))

    res.json({
      data: usersWithRoles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('Failed to fetch users:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch users' })
  }
})

// PATCH /roles/users/:userId - Change user role (Superadmin only)
router.patch('/users/:userId', requireSuperAdmin, validate(UpdateUserRoleByNameSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { role: roleName } = req.body

    const role = await prisma.role.findUnique({
      where: { name: roleName },
    })

    if (!role) {
      return res.status(400).json({ success: false, error: 'Invalid role' })
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { roleId: role.id },
      include: { role: true },
    })

    res.json({
      message: 'User role updated successfully',
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        roleId: updated.roleId,
        role: updated.role.name,
        permissions: updated.role.permissions,
      },
    })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    console.error('Failed to update user role:', err)
    res.status(500).json({ success: false, error: 'Failed to update user role' })
  }
})

// GET /roles/users/:userId - Get user role info (Admin access)
router.get('/users/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: { role: true },
    })

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name,
      permissions: user.role.permissions,
      createdAt: user.createdAt,
    })
  } catch (err) {
    console.error('Failed to fetch user:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch user' })
  }
})

export default router
