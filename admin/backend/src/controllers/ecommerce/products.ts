import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'
import { generateUniqueSlug } from '../../utils/slug'
import { logger } from '../../utils/logger'

// The "done" account status has historically been stored inconsistently across
// sheets ("Completed" vs "completed") - match both casings rather than one.
const DONE_STATUSES = ['Completed', 'completed']

function eligibilityWhere(sourceId: number): Record<string, unknown> {
  return {
    sourceId,
    isSold: false,
    accountStatus: { in: DONE_STATUSES },
    reservedOrderId: null,
  }
}

type ProductWithVariants = { id: number; sourceId?: number | null; variants?: { id: number; targetFollowers?: number | null }[] }

// Merges the count of available (unsold, status "Selesai") Account rows into
// each product's variants, since stock is now always derived from the linked
// Source rather than a manual number or upload.
async function attachVariantStock<T extends ProductWithVariants>(products: T[]): Promise<T[]> {
  for (const product of products) {
    if (!product.variants || !product.sourceId) continue

    product.variants = await Promise.all(
      product.variants.map(async (v) => ({
        ...v,
        availableStock: await db.account.count({
          where: {
            ...eligibilityWhere(product.sourceId as number),
            targetFollowers: v.targetFollowers ?? null,
          },
        }),
      }))
    ) as typeof product.variants
  }

  return products
}

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
      if (sectionId) where.sectionId = parseInt(sectionId)

      const [total, products] = await Promise.all([
        db.product.count({ where }),
        db.product.findMany({
          where,
          include: {
            section: { select: { title: true } },
            source: { select: { id: true, name: true } },
            variants: { orderBy: { order: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ])

      res.json({
        data: await attachVariantStock(products),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      logger.error('[Products List Error]', err)
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
          source: { select: { id: true, name: true } },
          variants: { orderBy: { order: 'asc' } },
        },
      })

      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' })
        return
      }

      const [withVariantStock] = await attachVariantStock([product])
      res.json(withVariantStock)
    } catch (err) {
      logger.error('[Product Detail Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch product detail' })
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { title, description, price, sectionId, imageUrl, sourceId } = req.body
      const slug = await generateUniqueSlug(title)

      const product = await db.product.create({
        data: {
          title,
          slug,
          description,
          price: parseFloat(price),
          sectionId: sectionId || null,
          imageUrl: imageUrl || null,
          sourceId: sourceId ? parseInt(String(sourceId)) : null,
          inStock: 0,
        },
        include: { section: { select: { title: true } }, source: { select: { id: true, name: true } } },
      })

      res.status(201).json(product)
    } catch (err) {
      logger.error('[Create Product Error]', err)
      res.status(500).json({ success: false, error: 'Failed to create product' })
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { title, description, price, sectionId, inStock, isVerified, imageUrl, sourceId } = req.body

      const data: Prisma.ProductUpdateInput = {}
      if (title !== undefined) {
        data.title = title
        data.slug = await generateUniqueSlug(title, parseInt(id))
      }
      if (description !== undefined) data.description = description
      if (price !== undefined) data.price = parseFloat(price)
      if (sectionId !== undefined) data.section = sectionId ? { connect: { id: sectionId } } : { disconnect: true }
      if (inStock !== undefined) data.inStock = parseInt(inStock)
      if (isVerified !== undefined) data.isVerified = isVerified
      if (imageUrl !== undefined) data.imageUrl = imageUrl || null
      if (sourceId !== undefined) data.source = sourceId ? { connect: { id: parseInt(String(sourceId)) } } : { disconnect: true }

      const product = await db.product.update({
        where: { id: parseInt(id) },
        data,
        include: { section: { select: { title: true } }, source: { select: { id: true, name: true } } },
      })

      res.json(product)
    } catch (err) {
      logger.error('[Update Product Error]', err)
      res.status(500).json({ success: false, error: 'Failed to update product' })
    }
  }

  static async replaceVariants(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id)
      const { variantLabel, variants } = req.body as {
        variantLabel?: string | null
        variants: Array<{ name: string; price: number | string; targetFollowers?: number | null; isActive?: boolean }>
      }

      // Toggling variations off (empty list) permanently deletes existing opsi for this product.
      await db.$transaction([
        db.product.update({
          where: { id: productId },
          data: { variantLabel: variants.length > 0 ? (variantLabel || null) : null },
        }),
        db.productVariant.deleteMany({ where: { productId } }),
        ...variants.map((v, index) =>
          db.productVariant.create({
            data: {
              productId,
              name: v.name,
              price: typeof v.price === 'string' ? parseFloat(v.price) : v.price,
              targetFollowers: v.targetFollowers ?? null,
              order: index,
              isActive: v.isActive ?? true,
            },
          })
        ),
      ])

      const updatedVariants = await db.productVariant.findMany({
        where: { productId },
        orderBy: { order: 'asc' },
      })

      res.json({ data: updatedVariants })
    } catch (err) {
      logger.error('[Replace Product Variants Error]', err)
      res.status(500).json({ success: false, error: 'Failed to save product price variants' })
    }
  }

  // Auto-detects price-tier candidates for a Source: distinct targetFollowers values
  // among its unsold, "Selesai"-status Account rows, so the admin only has to fill in price.
  static async detectVariants(req: Request, res: Response): Promise<void> {
    try {
      const sourceId = parseInt(req.params.sourceId)

      const rows = await db.account.groupBy({
        by: ['targetFollowers'],
        where: eligibilityWhere(sourceId),
        _count: true,
      })

      const candidates = rows
        .filter((r) => r.targetFollowers !== null)
        .map((r) => ({
          targetFollowers: r.targetFollowers,
          count: r._count,
          suggestedName: `${(r.targetFollowers as number).toLocaleString('id-ID')}+ Followers`,
        }))
        .sort((a, b) => (a.targetFollowers ?? 0) - (b.targetFollowers ?? 0))

      res.json({ data: candidates })
    } catch (err) {
      logger.error('[Detect Variants Error]', err)
      res.status(500).json({ success: false, error: 'Failed to detect variant candidates' })
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
      logger.error('[Delete Product Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete product' })
    }
  }
}
