import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'
import bcrypt from 'bcryptjs'
import { logger } from '../../utils/logger'

const prisma = db

export const UsersController = {
  async index(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 15

      const users = await prisma.user.findMany({
        include: { role: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })

      const total = await prisma.user.count()

      const usersWithoutPassword = users.map((user) => {
        const { password, ...rest } = user
        return rest
      })

      const roles = await prisma.role.findMany()

      res.json({
        users: usersWithoutPassword,
        roles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('Error fetching users:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch users' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { name, email, password, role_id } = req.body

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' })
      }

      const hashedPassword = await bcrypt.hash(password, 10)

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          roleId: role_id || 3,
        },
        include: { role: true },
      })

      const { password: _, ...userWithoutPassword } = user
      res.status(201).json({ success: true, user: userWithoutPassword })
    } catch (error) {
      logger.error('Error creating user:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Email already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create user' })
      }
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, email, password, role_id } = req.body

      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' })
      }

      const updateData: Prisma.UserUpdateInput = {
        name,
        email,
        role: role_id ? { connect: { id: parseInt(String(role_id)) } } : undefined,
      }

      if (password) {
        updateData.password = await bcrypt.hash(password, 10)
      }

      const user = await prisma.user.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: { role: true },
      })

      const { password: _, ...userWithoutPassword } = user
      res.json({ success: true, user: userWithoutPassword })
    } catch (error) {
      logger.error('Error updating user:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Email already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update user' })
      }
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params

      await prisma.user.delete({
        where: { id: parseInt(id) },
      })

      res.json({ success: true, message: 'User deleted successfully' })
    } catch (error) {
      logger.error('Error deleting user:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete user' })
    }
  },
}
