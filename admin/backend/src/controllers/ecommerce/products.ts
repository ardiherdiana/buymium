import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'

type ProductWithVariants = { id: number; variants?: { id: number }[] }

// Merges the count of available (unsold) stock/credential rows into each product's variants,
// since variant stock is derived from assigned credentials rather than a manual number.
async function attachVariantStock<T extends ProductWithVariants>(products: T[]): Promise<T[]> {
  const variantIds = products.flatMap((p) => (p.variants ?? []).map((v) => v.id))
  if (variantIds.length === 0) return products

  const counts = await db.stock.groupBy({
    by: ['variantId'],
    where: { variantId: { in: variantIds }, status: 'available' },
    _count: true,
  })
  const countByVariantId = new Map(counts.map((c) => [c.variantId, c._count]))

  for (const product of products) {
    if (!product.variants) continue
    product.variants = product.variants.map((v) => ({
      ...v,
      availableStock: countByVariantId.get(v.id) ?? 0,
    })) as typeof product.variants
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
          stocks: { where: { status: 'available' } },
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
      const { title, description, price, sectionId, tags = [], imageUrl } = req.body

      const product = await db.product.create({
        data: {
          title,
          description,
          price: parseFloat(price),
          sectionId: sectionId || null,
          tags: JSON.stringify(tags),
          imageUrl: imageUrl || null,
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
      const { title, description, price, sectionId, tags, inStock, isVerified, imageUrl } = req.body

      const data: Prisma.ProductUpdateInput = {}
      if (title !== undefined) data.title = title
      if (description !== undefined) data.description = description
      if (price !== undefined) data.price = parseFloat(price)
      if (sectionId !== undefined) data.section = sectionId ? { connect: { id: sectionId } } : { disconnect: true }
      if (tags !== undefined) data.tags = JSON.stringify(tags)
      if (inStock !== undefined) data.inStock = parseInt(inStock)
      if (isVerified !== undefined) data.isVerified = isVerified
      if (imageUrl !== undefined) data.imageUrl = imageUrl || null

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

  static async replaceVariants(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.id)
      const { variantLabel, variants } = req.body as {
        variantLabel?: string | null
        variants: Array<{ name: string; price: number | string; isActive?: boolean }>
      }

      // Toggling variations off (empty list) permanently deletes existing opsi for this product;
      // any credential/stock rows assigned to them fall back to unassigned (variant_id set null by the FK).
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
