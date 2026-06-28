import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { logger } from '../../utils/logger'
import db from '../../config/database'

const prisma = db

export const ExpensesController = {
  async index(req: Request, res: Response) {
    try {
      const searchQuery = req.query.search as string
      const categoryIdFilter = req.query.category_id as string
      const sourceIdFilter = req.query.source_id as string
      const year = req.query.year as string || String(new Date().getFullYear())
      const month = req.query.month as string || String(new Date().getMonth() + 1)
      const page = parseInt(req.query.page as string) || 1
      const limit = 50

      let where: Prisma.ExpenseWhereInput = {}

      if (searchQuery) {
        where.OR = [{ category: { name: { contains: searchQuery } } }]
      }

      if (categoryIdFilter && categoryIdFilter !== 'all') {
        where.categoryId = parseInt(categoryIdFilter)
      }

      if (sourceIdFilter && sourceIdFilter !== 'all') {
        where.sourceId = parseInt(sourceIdFilter)
      }

      if (year !== 'all') {
        const yearInt = parseInt(year)
        where.expenseDate = {
          gte: new Date(yearInt, 0, 1),
          lte: new Date(yearInt, 11, 31),
        }
      }

      if (month !== 'all' && year !== 'all') {
        const yearInt = parseInt(year)
        const monthInt = parseInt(month)
        where.expenseDate = {
          gte: new Date(yearInt, monthInt - 1, 1),
          lte: new Date(yearInt, monthInt, 0),
        }
      }

      const expenses = await prisma.expense.findMany({
        where,
        include: { category: true, source: true },
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      })

      const total = await prisma.expense.count({ where })

      const categories = await prisma.expenseCategory.findMany({
        orderBy: { name: 'asc' },
      })

      const sources = await prisma.source.findMany({
        orderBy: [{ id: 'asc' }],
      })

      res.json({
        expenses,
        categories,
        sources,
        filters: {
          search: searchQuery || '',
          category_id: categoryIdFilter || 'all',
          source_id: sourceIdFilter || 'all',
          year,
          month,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('Error fetching expenses:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch expenses' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { amount, expense_date, category_id, source_id } = req.body

      if (!amount || !expense_date || !category_id) {
        return res.status(400).json({ error: 'Amount, expense_date, and category_id are required' })
      }

      const expense = await prisma.expense.create({
        data: {
          amount,
          expenseDate: new Date(expense_date),
          categoryId: parseInt(category_id),
          sourceId: source_id ? parseInt(source_id) : null,
        },
        include: { category: true, source: true },
      })

      res.status(201).json({ success: true, expense })
    } catch (error) {
      logger.error('Error creating expense:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create expense' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { amount, expense_date, category_id, source_id } = req.body

      if (!amount || !expense_date || !category_id) {
        return res.status(400).json({ error: 'Amount, expense_date, and category_id are required' })
      }

      const expense = await prisma.expense.update({
        where: { id: parseInt(id) },
        data: {
          amount,
          expenseDate: new Date(expense_date),
          categoryId: parseInt(category_id),
          sourceId: source_id ? parseInt(source_id) : null,
        },
        include: { category: true, source: true },
      })

      res.json({ success: true, expense })
    } catch (error) {
      logger.error('Error updating expense:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update expense' })
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params

      await prisma.expense.delete({
        where: { id: parseInt(id) },
      })

      res.json({ success: true, message: 'Expense deleted successfully' })
    } catch (error) {
      logger.error('Error deleting expense:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete expense' })
    }
  },
}
