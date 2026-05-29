import { Request, Response } from 'express'
import db from '../../config/database'
import { logger } from '../../utils/logger'

const prisma = db

export const ExpenseCategoriesController = {
  async index(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 15

      const categories = await prisma.expenseCategory.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })

      const total = await prisma.expenseCategory.count()

      res.json({
        categories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('Error fetching expense categories:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch categories' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { name, description } = req.body

      if (!name) {
        return res.status(400).json({ error: 'Name is required' })
      }

      const category = await prisma.expenseCategory.create({
        data: {
          name,
          ...(description && { description: description }),
        },
      })

      res.status(201).json({ success: true, category })
    } catch (error) {
      logger.error('Error creating expense category:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Category name already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create category' })
      }
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, description } = req.body

      if (!name) {
        return res.status(400).json({ error: 'Name is required' })
      }

      const category = await prisma.expenseCategory.update({
        where: { id: parseInt(id) },
        data: {
          name,
          ...(description !== undefined && { description }),
        },
      })

      res.json({ success: true, category })
    } catch (error) {
      logger.error('Error updating expense category:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Category name already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update category' })
      }
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params

      await prisma.expenseCategory.delete({
        where: { id: parseInt(id) },
      })

      res.json({ success: true, message: 'Category deleted successfully' })
    } catch (error) {
      logger.error('Error deleting expense category:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete category' })
    }
  },
}
