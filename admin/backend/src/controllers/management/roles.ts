import { Request, Response } from 'express'
import db from '../../config/database'
import { logger } from '../../utils/logger'

const prisma = db

export const RolesController = {
  async index(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 15

      const roles = await prisma.role.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })

      const total = await prisma.role.count()

      res.json({
        roles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('Error fetching roles:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch roles' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { name, display_name, description } = req.body

      if (!name || !display_name) {
        return res.status(400).json({ error: 'Name and display_name are required' })
      }

      const role = await prisma.role.create({
        data: {
          name,
          description: description || null,
          permissions: '{}',
          displayName: display_name,
        },
      })

      res.status(201).json({ success: true, role })
    } catch (error) {
      logger.error('Error creating role:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Role name already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create role' })
      }
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, display_name, description } = req.body

      if (!name || !display_name) {
        return res.status(400).json({ error: 'Name and display_name are required' })
      }

      const role = await prisma.role.update({
        where: { id: parseInt(id) },
        data: {
          name,
          description: description || null,
          displayName: display_name,
        },
      })

      res.json({ success: true, role })
    } catch (error) {
      logger.error('Error updating role:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Role name already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update role' })
      }
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params

      await prisma.role.delete({
        where: { id: parseInt(id) },
      })

      res.json({ success: true, message: 'Role deleted successfully' })
    } catch (error) {
      logger.error('Error deleting role:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete role' })
    }
  },
}
