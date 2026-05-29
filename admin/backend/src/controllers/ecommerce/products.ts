import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'

export class ProductsController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20')) || 20))
      const rawSearch = req.query.search as string | undefined
      const search = rawSearch ? rawSearch.slice(0, 100) : undefined
      const sectionId = req.query.sectionId as string | undefined

      const where: Prisma.ProductWhereInput = {}
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { description: { contains: search } },
        ]
      }
      if (sectionId) where.sectionId = sectionId

      const [total, products] = await Promise.all([
        db.product.count({ where }),
        db.product.findMany({
          where,
          include: { section: { select: { title: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ])

      res.json({
        data: products,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      console.error('[Products List Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch products' })
    }
  }

  static async show(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const product = await db.product.findUnique({
        where: { id: parseInt(id) },
        include: {
          section: true,
          stocks: { where: { status: 'available' } },
        },
      })

      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' })
        return
      }

      res.json(product)
    } catch (err) {
      console.error('[Product Detail Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch product detail' })
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { title, description, price, sectionId, tags = [] } = req.body

      const product = await db.product.create({
        data: {
          title,
          description,
          price: parseFloat(price),
          sectionId: sectionId || null,
          tags: JSON.stringify(tags),
          inStock: 0,
        },
        include: { section: { select: { title: true } } },
      })

      res.status(201).json(product)
    } catch (err) {
      console.error('[Create Product Error]', err)
      res.status(500).json({ success: false, error: 'Failed to create product' })
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { title, description, price, sectionId, tags, inStock, isVerified } = req.body

      const data: Prisma.ProductUpdateInput = {}
      if (title !== undefined) data.title = title
      if (description !== undefined) data.description = description
      if (price !== undefined) data.price = parseFloat(price)
      if (sectionId !== undefined) data.section = sectionId ? { connect: { id: sectionId } } : { disconnect: true }
      if (tags !== undefined) data.tags = JSON.stringify(tags)
      if (inStock !== undefined) data.inStock = parseInt(inStock)
      if (isVerified !== undefined) data.isVerified = isVerified

      const product = await db.product.update({
        where: { id: parseInt(id) },
        data,
        include: { section: { select: { title: true } } },
      })

      res.json(product)
    } catch (err) {
      console.error('[Update Product Error]', err)
      res.status(500).json({ success: false, error: 'Failed to update product' })
    }
  }

  static async destroy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      await db.product.delete({
        where: { id: parseInt(id) },
      })

      res.json({ message: 'Product deleted successfully' })
    } catch (err) {
      console.error('[Delete Product Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete product' })
    }
  }
}
