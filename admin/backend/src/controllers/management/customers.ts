import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { logger } from '../../utils/logger'
import db from '../../config/database'

const prisma = db

export const CustomersController = {
  async index(req: Request, res: Response) {
    try {
      const searchQuery = req.query.search as string
      const page = parseInt(req.query.page as string) || 1
      const limit = 15

      const where: Prisma.CustomerWhereInput = {}

      if (searchQuery) {
        where.OR = [
          { usernameSh: { contains: searchQuery } },
          { nomorHp: { contains: searchQuery } },
        ]
      }

      const allIds = await prisma.customer.findMany({
        where,
        select: { id: true },
      })
      const ids = allIds.map(c => c.id)

      const profitRows = await prisma.sale.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids } },
        _sum: { totalProfit: true },
      })
      const profitMap = new Map(profitRows.map(r => [r.customerId, r._sum.totalProfit || 0]))

      const sortedIds = [...ids].sort((a, b) => (profitMap.get(b) || 0) - (profitMap.get(a) || 0))
      const totalCount = sortedIds.length
      const paginatedIds = sortedIds.slice((page - 1) * limit, page * limit)

      const customers = await prisma.customer.findMany({
        where: { id: { in: paginatedIds } },
        include: { creator: true },
      })

      const customerMap = new Map(customers.map(c => [c.id, c]))
      const customersWithProfit = paginatedIds
        .map(id => customerMap.get(id))
        .filter(Boolean)
        .map(customer => ({
          id: customer!.id,
          username_shopee: customer!.usernameSh,
          nomor_hp: customer!.nomorHp,
          creator: customer!.creator ? { id: customer!.creator.id, name: customer!.creator.name } : null,
          created_at: customer!.createdAt,
          total_profit: profitMap.get(customer!.id) || 0,
        }))

      res.json({
        customers: customersWithProfit,
        filters: { search: searchQuery || '' },
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      })
    } catch (error) {
      logger.error('Error in customers index:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
    }
  },

  async show(req: Request, res: Response) {
    try {
      const { id } = req.params
      const page = parseInt(req.query.page as string) || 1
      const limit = 10

      const customer = await prisma.customer.findUnique({
        where: { id: parseInt(id) },
      })

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' })
      }

      const [salesCount, salesAgg] = await Promise.all([
        prisma.sale.count({ where: { customerId: customer.id } }),
        prisma.sale.aggregate({
          where: { customerId: customer.id },
          _sum: { totalSalePrice: true, totalProfit: true },
        }),
      ])

      const sales = await prisma.sale.findMany({
        where: { customerId: customer.id },
        select: {
          id: true,
          salesNumber: true,
          totalSalePrice: true,
          totalProfit: true,
          createdAt: true,
          _count: { select: { saleLines: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })

      const salesWithDetails = sales.map((sale) => ({
        id: sale.id,
        sales_number: sale.salesNumber,
        total_sale_price: sale.totalSalePrice,
        total_profit: sale.totalProfit,
        total_accounts: sale._count.saleLines,
        created_at: sale.createdAt,
      }))

      res.json({
        customer: {
          id: customer.id,
          username_shopee: customer.usernameSh,
          nomor_hp: customer.nomorHp,
          created_at: customer.createdAt,
        },
        stats: {
          total_sales_count: salesCount,
          total_sales_amount: salesAgg._sum.totalSalePrice || 0,
          total_profit: salesAgg._sum.totalProfit || 0,
        },
        sales: salesWithDetails,
        pagination: {
          page,
          limit,
          total: salesCount,
          pages: Math.ceil(salesCount / limit),
        },
      })
    } catch (error) {
      logger.error('Error in customer show:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { username_shopee, nomor_hp } = req.body
      const userId = req.user?.userId

      if (!username_shopee) {
        return res.status(400).json({ error: 'username_shopee is required' })
      }

      const customer = await prisma.customer.create({
        data: {
          usernameSh: username_shopee,
          nomorHp: nomor_hp || null,
          createdBy: userId,
        },
      })

      res.status(201).json({ success: true, customer })
    } catch (error) {
      logger.error('Error creating customer:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create customer' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { username_shopee, nomor_hp } = req.body

      if (!username_shopee) {
        return res.status(400).json({ error: 'username_shopee is required' })
      }

      const customer = await prisma.customer.update({
        where: { id: parseInt(id) },
        data: {
          usernameSh: username_shopee,
          nomorHp: nomor_hp || null,
        },
      })

      res.json({ success: true, customer })
    } catch (error) {
      logger.error('Error updating customer:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update customer' })
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params

      await prisma.customer.delete({
        where: { id: parseInt(id) },
      })

      res.json({ success: true, message: 'Customer deleted successfully' })
    } catch (error) {
      logger.error('Error deleting customer:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete customer' })
    }
  },
}
