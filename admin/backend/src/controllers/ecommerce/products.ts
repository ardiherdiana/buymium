import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'
import { generateUniqueSlug } from '../../utils/slug'

// The "done" account status is stored inconsistently across Account ("Completed") and
// Accsmarket ("completed") rows - match both casings rather than relying on one.
const DONE_STATUSES = ['Completed', 'completed']

// Accsmarket-backed sources additionally require the account to be at least 2 years
// old (Account has no `year` field, so this only ever applies to Accsmarket rows).
function eligibilityWhere(sourceId: number, isAccsmarket: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = {
    sourceId,
    isSold: false,
    accountStatus: { in: DONE_STATUSES },
    reservedOrderId: null,
  }
  if (isAccsmarket) {
    const cutoffYear = new Date().getFullYear() - 2
    base.year = { lte: String(cutoffYear) }
  }
  return base
}

type ProductWithVariants = { id: number; sourceId?: number | null; variants?: { id: number; targetFollowers?: number | null }[] }

// Merges the count of available (unsold, status "Selesai") Account/Accsmarket rows into
// each product's variants, since stock is now always derived from the linked Source rather
// than a manual number or upload.
async function attachVariantStock<T extends ProductWithVariants>(products: T[]): Promise<T[]> {
  const sourceIds = [...new Set(products.filter((p) => p.sourceId).map((p) => p.sourceId as number))]
  if (sourceIds.length === 0) return products

  const sources = await db.source.findMany({ where: { id: { in: sourceIds } } })
  const isAccsmarketBySourceId = new Map(sources.map((s) => [s.id, s.isAccsmarket]))

  for (const product of products) {
    if (!product.variants || !product.sourceId) continue
    const isAccsmarket = isAccsmarketBySourceId.get(product.sourceId) ?? false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table: any = isAccsmarket ? db.accsmarket : db.account

    product.variants = await Promise.all(
      product.variants.map(async (v) => ({
        ...v,
        availableStock: await table.count({
          where: {
            ...eligibilityWhere(product.sourceId as number, isAccsmarket),
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
      console.error('[Product Detail Error]', err)
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
      console.error('[Create Product Error]', err)
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
      console.error('[Update Product Error]', err)
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
      console.error('[Replace Product Variants Error]', err)
      res.status(500).json({ success: false, error: 'Failed to save product price variants' })
    }
  }

  // Auto-detects price-tier candidates for a Source: distinct targetFollowers values among
  // its unsold, "Selesai"-status Account/Accsmarket rows, so the admin only has to fill in price.
  static async detectVariants(req: Request, res: Response): Promise<void> {
    try {
      const sourceId = parseInt(req.params.sourceId)
      const source = await db.source.findUnique({ where: { id: sourceId } })
      if (!source) { res.status(404).json({ success: false, error: 'Source not found' }); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table: any = source.isAccsmarket ? db.accsmarket : db.account
      const rows = await table.groupBy({
        by: ['targetFollowers'],
        where: eligibilityWhere(sourceId, source.isAccsmarket),
        _count: true,
      })

      const candidates = rows
        .filter((r: { targetFollowers: number | null }) => r.targetFollowers !== null)
        .map((r: { targetFollowers: number | null; _count: number }) => ({
          targetFollowers: r.targetFollowers,
          count: r._count,
          suggestedName: `${(r.targetFollowers as number).toLocaleString('id-ID')}+ Followers`,
        }))
        .sort((a: { targetFollowers: number | null }, b: { targetFollowers: number | null }) => (a.targetFollowers ?? 0) - (b.targetFollowers ?? 0))

      res.json({ data: candidates })
    } catch (err) {
      console.error('[Detect Variants Error]', err)
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
      console.error('[Delete Product Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete product' })
    }
  }
}
