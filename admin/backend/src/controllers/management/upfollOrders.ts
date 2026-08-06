import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { logger } from '../../utils/logger'
import db from '../../config/database'
import { UpfollService } from '../../services/management/upfollService'

const prisma = db

const mapItem = (item: {
  id: number
  username: string
  startingFollowers: number | null
  currentFollowers: number | null
  status: string
  capital: number
  unitSalePrice: number
  profit: number
  vendorTier: { id: number; name: string; targetFollowers: number; vendor: { id: number; name: string } }
}) => ({
  id: item.id,
  username: item.username,
  starting_followers: item.startingFollowers,
  current_followers: item.currentFollowers,
  target_followers: (item.startingFollowers ?? 0) + item.vendorTier.targetFollowers,
  status: item.status,
  capital: item.capital,
  unit_sale_price: item.unitSalePrice,
  profit: item.profit,
  vendor_tier: {
    id: item.vendorTier.id,
    name: item.vendorTier.name,
    target_followers: item.vendorTier.targetFollowers,
    vendor: item.vendorTier.vendor,
  },
})

export const UpfollOrdersController = {
  async index(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 15
      const searchQuery = req.query.search as string
      const status = req.query.status as string
      const vendorId = req.query.vendor_id ? parseInt(req.query.vendor_id as string) : undefined

      const where: Prisma.UpfollOrderWhereInput = {}
      if (searchQuery) {
        where.OR = [
          { orderNumber: { contains: searchQuery } },
          { customer: { usernameSh: { contains: searchQuery } } },
          { items: { some: { username: { contains: searchQuery } } } },
        ]
      }
      if ((status && status !== 'all') || vendorId) {
        const itemFilter: Prisma.UpfollItemWhereInput = {}
        if (status && status !== 'all') itemFilter.status = status
        if (vendorId) itemFilter.vendorTier = { vendorId }
        where.items = { some: itemFilter }
      }

      const [orders, total, salesAgg, items] = await Promise.all([
        prisma.upfollOrder.findMany({
          where,
          include: {
            customer: true,
            items: { include: { vendorTier: { include: { vendor: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.upfollOrder.count({ where }),
        prisma.upfollOrder.aggregate({
          where,
          _sum: { totalSalePrice: true, totalProfit: true },
        }),
        prisma.upfollItem.findMany({
          where: { order: where },
          select: { startingFollowers: true, vendorTier: { select: { targetFollowers: true } } },
        }),
      ])

      const ordersWithMapping = orders.map((order) => ({
        id: order.id,
        order_number: order.orderNumber,
        customer_id: order.customerId,
        total_sale_price: order.totalSalePrice,
        total_profit: order.totalProfit,
        is_shopee: order.isShopee,
        shopee_order_number: order.shopeeOrderNumber,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        customer: order.customer ? { id: order.customer.id, username_shopee: order.customer.usernameSh } : undefined,
        items: order.items.map(mapItem),
      }))

      const totalFollowers = items.reduce((sum, item) => sum + (item.startingFollowers ?? 0) + item.vendorTier.targetFollowers, 0)

      res.json({
        orders: ordersWithMapping,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        stats: {
          total_orders: total,
          total_usernames: items.length,
          total_followers: totalFollowers,
          total_sale_price: salesAgg._sum.totalSalePrice ?? 0,
          total_profit: salesAgg._sum.totalProfit ?? 0,
        },
      })
    } catch (error) {
      logger.error('Gagal mengambil data pesanan upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal mengambil data pesanan upfoll' })
    }
  },

  async show(req: Request, res: Response) {
    try {
      const { id } = req.params
      const order = await prisma.upfollOrder.findUnique({
        where: { id: parseInt(id) },
        include: { customer: true, items: { include: { vendorTier: { include: { vendor: true } } } } },
      })
      if (!order) return res.status(404).json({ error: 'Pesanan upfoll tidak ditemukan' })

      res.json({
        order: {
          id: order.id,
          order_number: order.orderNumber,
          customer_id: order.customerId,
          total_sale_price: order.totalSalePrice,
          total_profit: order.totalProfit,
          is_shopee: order.isShopee,
          shopee_order_number: order.shopeeOrderNumber,
          created_at: order.createdAt,
          updated_at: order.updatedAt,
          customer: order.customer ? { id: order.customer.id, username_shopee: order.customer.usernameSh, nomor_hp: order.customer.nomorHp } : undefined,
          items: order.items.map(mapItem),
        },
      })
    } catch (error) {
      logger.error('Gagal mengambil detail pesanan upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal mengambil detail pesanan upfoll' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { customer_id, total_sale_price, is_shopee, shopee_order_number, items } = req.body as {
        customer_id: string | number
        total_sale_price: string | number
        is_shopee?: boolean
        shopee_order_number?: string | null
        items: { username: string; vendor_tier_id: string | number }[]
      }

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Minimal harus ada 1 username' })
      }

      // Tolak duplikat dalam satu submission sebelum menyentuh DB
      const seen = new Set<string>()
      for (const item of items) {
        const key = `${item.username.trim().toLowerCase()}::${item.vendor_tier_id}`
        if (seen.has(key)) {
          return res.status(409).json({ error: `Username '${item.username}' duplikat dalam pesanan ini` })
        }
        seen.add(key)
      }

      const vendorTierIds = items.map((item) => parseInt(String(item.vendor_tier_id)))

      // Pre-check ke data yang sudah ada supaya pesan errornya lebih jelas daripada raw constraint violation
      const conflicts = await prisma.upfollItem.findMany({
        where: {
          OR: items.map((item) => ({
            username: item.username.trim(),
            vendorTierId: parseInt(String(item.vendor_tier_id)),
          })),
        },
        include: { vendorTier: true },
      })

      if (conflicts.length > 0) {
        const first = conflicts[0]
        return res.status(409).json({
          error: `Username '${first.username}' sudah pernah dipakai di tier '${first.vendorTier.name}'`,
        })
      }

      const vendorTiers = await prisma.upfollVendorTier.findMany({ where: { id: { in: vendorTierIds } } })
      const tierById = new Map(vendorTiers.map((vt) => [vt.id, vt]))

      for (const item of items) {
        const vendorTierId = parseInt(String(item.vendor_tier_id))
        if (!tierById.has(vendorTierId)) {
          return res.status(400).json({ error: `Tier vendor tidak ditemukan (username '${item.username}')` })
        }
      }

      // Scan each username's current follower count before creating anything, so the
      // real completion target is (baseline + package target) rather than the flat
      // package target — e.g. an account with 2.400 followers ordering a "5.000
      // followers" package actually needs to reach 7.400, not just 5.000. Scanning
      // upfront (sequentially, to stay within RapidAPI rate limits) also catches
      // typo'd/nonexistent usernames before the order is created.
      const startingFollowersByUsername = new Map<string, number>()
      for (const item of items) {
        const username = item.username.trim()
        try {
          const count = await UpfollService.fetchFollowerCount(username)
          startingFollowersByUsername.set(username, count)
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Gagal memindai followers'
          return res.status(400).json({ error: `Gagal scan username '${username}': ${msg}` })
        }
      }

      const totalSalePriceNum = parseFloat(String(total_sale_price))
      const unitSalePrice = totalSalePriceNum / items.length
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const orderNumber = `UPFOLL${today}-${Date.now().toString().slice(-3)}`

      let totalProfit = 0
      const itemsData = items.map((item) => {
        const vendorTierId = parseInt(String(item.vendor_tier_id))
        const capital = tierById.get(vendorTierId)!.price
        const profit = unitSalePrice - capital
        totalProfit += profit
        const username = item.username.trim()
        const startingFollowers = startingFollowersByUsername.get(username) ?? null
        return {
          username,
          vendorTierId,
          startingFollowers,
          currentFollowers: startingFollowers,
          capital,
          unitSalePrice,
          profit,
        }
      })

      const customerIdNum = parseInt(String(customer_id))

      // Mirror into Sale/SaleLine so this order is automatically picked up by
      // the existing Finance > Sales and Analytics pages (see schema comment
      // on UpfollOrder.saleId) — no Account/Accsmarket lines involved here.
      const order = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            salesNumber: orderNumber,
            customerId: customerIdNum,
            totalSalePrice: totalSalePriceNum,
            totalProfit,
            isShopee: is_shopee || false,
            saleLines: {
              create: itemsData.map((item) => ({
                unitSalePrice: item.unitSalePrice,
                price: item.unitSalePrice,
                profit: item.profit,
              })),
            },
          },
        })

        return tx.upfollOrder.create({
          data: {
            orderNumber,
            customerId: customerIdNum,
            totalSalePrice: totalSalePriceNum,
            totalProfit,
            isShopee: is_shopee || false,
            shopeeOrderNumber: is_shopee ? shopee_order_number : undefined,
            createdBy: req.user?.userId,
            saleId: sale.id,
            items: { create: itemsData },
          },
          include: { customer: true, items: { include: { vendorTier: { include: { vendor: true } } } } },
        })
      })

      res.status(201).json({
        success: true,
        order: {
          id: order.id,
          order_number: order.orderNumber,
          customer_id: order.customerId,
          total_sale_price: order.totalSalePrice,
          total_profit: order.totalProfit,
          is_shopee: order.isShopee,
          shopee_order_number: order.shopeeOrderNumber,
          created_at: order.createdAt,
          customer: order.customer ? { id: order.customer.id, username_shopee: order.customer.usernameSh } : undefined,
          items: order.items.map(mapItem),
        },
      })
    } catch (error) {
      // Race dengan request lain yang lolos pre-check — unique constraint yang menangkapnya
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({ error: 'Salah satu username sudah pernah dipakai di tier yang sama' })
      }
      logger.error('Gagal membuat pesanan upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal membuat pesanan upfoll' })
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params
      const order = await prisma.upfollOrder.findUnique({ where: { id: parseInt(id) }, select: { saleId: true } })
      await prisma.upfollOrder.delete({ where: { id: parseInt(id) } })
      if (order?.saleId) {
        await prisma.sale.delete({ where: { id: order.saleId } }).catch(() => {})
      }
      res.json({ success: true, message: 'Pesanan upfoll berhasil dihapus' })
    } catch (error) {
      logger.error('Gagal menghapus pesanan upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal menghapus pesanan upfoll' })
    }
  },
}
