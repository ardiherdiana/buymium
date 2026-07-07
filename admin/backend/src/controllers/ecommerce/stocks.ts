import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'
import { encrypt, safeDecrypt } from '../../utils/encrypt'

function decryptStock(stock: { password?: string | null; passwordEmail?: string | null; twoFactorCode?: string | null; [key: string]: unknown }) {
  return {
    ...stock,
    password: safeDecrypt(stock.password ?? null),
    passwordEmail: safeDecrypt(stock.passwordEmail ?? null),
    twoFactorCode: safeDecrypt(stock.twoFactorCode ?? null),
  }
}

export class StocksController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20')) || 20))
      const rawSearch = req.query.search as string | undefined
      const search = rawSearch ? rawSearch.slice(0, 100) : undefined
      const status = req.query.status as string | undefined

      const where: Prisma.StockWhereInput = {}
      if (search) {
        where.OR = [
          { username: { contains: search } },
          { email: { contains: search } },
        ]
      }
      if (status && ['available', 'sold'].includes(status)) {
        where.status = status
      }

      const [total, stocks] = await Promise.all([
        db.stock.count({ where }),
        db.stock.findMany({
          where,
          include: { product: { select: { id: true, title: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ])

      res.json({
        data: stocks.map(decryptStock),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      console.error('[Stocks List Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch stocks' })
    }
  }

  static async show(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const stock = await db.stock.findUnique({
        where: { id: parseInt(id) },
        include: { product: true, order: true },
      })

      if (!stock) {
        res.status(404).json({ success: false, error: 'Stock not found' })
        return
      }

      res.json(decryptStock(stock))
    } catch (err) {
      console.error('[Stock Detail Error]', err)
      res.status(500).json({ error: 'Failed to fetch stock detail' })
    }
  }

  static async byProduct(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params
      const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
      const limit = Math.min(200, parseInt(String(req.query.limit || '100')) || 100)
      const status = req.query.status as string | undefined
      const variantId = req.query.variantId as string | undefined

      const where: Prisma.StockWhereInput = { productId: parseInt(productId) }
      if (status && ['available', 'sold'].includes(status)) where.status = status
      if (variantId) where.variantId = variantId === 'none' ? null : parseInt(variantId)

      const [total, stocks] = await Promise.all([
        db.stock.count({ where }),
        db.stock.findMany({
          where,
          include: { variant: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ])

      res.json({
        data: stocks.map(decryptStock),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      console.error('[Stocks By Product Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch stocks for product' })
    }
  }

  static async bulkCreate(req: Request, res: Response): Promise<void> {
    try {
      const { productId, variantId, data } = req.body as {
        productId: number
        variantId?: number | string | null
        data: Array<{
          username: string
          password: string
          email?: string
          password_email?: string
          two_factor_code?: string
        }>
      }

      const createdStocks = await db.$transaction(
        data.map((item) =>
          db.stock.create({
            data: {
              productId: parseInt(String(productId)),
              variantId: variantId ? parseInt(String(variantId)) : null,
              email: item.email || null,
              passwordEmail: item.password_email ? encrypt(item.password_email) : null,
              username: item.username,
              password: encrypt(item.password),
              twoFactorCode: item.two_factor_code ? encrypt(item.two_factor_code) : null,
              status: 'available',
            },
          })
        )
      )

      const totalAvailable = await db.stock.count({
        where: { productId: parseInt(String(productId)), status: 'available' },
      })

      await db.product.update({
        where: { id: parseInt(String(productId)) },
        data: { inStock: totalAvailable },
      })

      res.status(201).json({
        message: `${createdStocks.length} stok berhasil diunggah`,
        count: createdStocks.length,
      })
    } catch (err) {
      console.error('[Stocks Bulk Error]', err)
      res.status(500).json({ success: false, error: 'Failed to bulk upload stocks' })
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { productId, variantId, email, passwordEmail, username, password, twoFactorCode } = req.body

      const stock = await db.stock.create({
        data: {
          productId: parseInt(productId),
          variantId: variantId ? parseInt(variantId) : null,
          email: email || null,
          passwordEmail: passwordEmail ? encrypt(passwordEmail) : null,
          username,
          password: encrypt(password),
          twoFactorCode: twoFactorCode ? encrypt(twoFactorCode) : null,
          status: 'available',
        },
        include: { product: { select: { id: true, title: true } } },
      })

      res.status(201).json(decryptStock(stock))
    } catch (err) {
      console.error('[Create Stock Error]', err)
      res.status(500).json({ success: false, error: 'Failed to create stock' })
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { email, passwordEmail, username, password, twoFactorCode, status } = req.body

      const data: Prisma.StockUpdateInput = {}
      if (email !== undefined) data.email = email
      if (passwordEmail !== undefined) data.passwordEmail = passwordEmail ? encrypt(passwordEmail) : null
      if (username !== undefined) data.username = username
      if (password !== undefined) data.password = encrypt(password)
      if (twoFactorCode !== undefined) data.twoFactorCode = twoFactorCode ? encrypt(twoFactorCode) : null
      if (status !== undefined && ['available', 'sold'].includes(status)) data.status = status

      const stock = await db.stock.update({
        where: { id: parseInt(id) },
        data,
        include: { product: { select: { id: true, title: true } } },
      })

      res.json(decryptStock(stock))
    } catch (err) {
      console.error('[Update Stock Error]', err)
      res.status(500).json({ success: false, error: 'Failed to update stock' })
    }
  }

  static async destroy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      await db.stock.delete({
        where: { id: parseInt(id) },
      })

      res.json({ message: 'Stock deleted successfully' })
    } catch (err) {
      console.error('[Delete Stock Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete stock' })
    }
  }
}
