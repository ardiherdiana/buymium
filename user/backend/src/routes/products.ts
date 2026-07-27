import { Router, Request, Response } from 'express'
import { Prisma, Product } from '@prisma/client'
import db from '../config/database'
import { requireAdmin } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { CreateProductSchema, UpdateProductSchema } from '../validators'
import { countAvailableInventory, listInventoryPreview, getProductVariants } from '../utils/inventory'

const router = Router()

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function findProductByIdOrSlug(idOrSlug: string): Promise<Product | null> {
  if (/^\d+$/.test(idOrSlug)) {
    return db.product.findUnique({ where: { id: parseInt(idOrSlug) } })
  }
  const bySlug = await db.product.findUnique({ where: { slug: idOrSlug } })
  if (bySlug) return bySlug
  const products = await db.product.findMany({ where: { slug: null } })
  return products.find((p) => slugify(p.title) === idOrSlug) ?? null
}

async function parseProduct(p: Product) {
  const inStock = p.sourceId ? await countAvailableInventory(p.id, p.sourceId) : p.inStock
  const [ratingAgg, soldAgg] = await Promise.all([
    db.testimonial.aggregate({
      where: { productId: p.id, isPublished: true, rating: { gte: 4 } },
      _avg: { rating: true },
    }),
    db.order.aggregate({
      where: { productId: p.id, status: 'paid' },
      _sum: { quantity: true },
    }),
  ])
  const rating = ratingAgg._avg.rating ? parseFloat(ratingAgg._avg.rating.toFixed(1)) : 0
  const soldCount = soldAgg._sum.quantity ?? 0
  return { ...p, slug: p.slug ?? slugify(p.title), inStock, rating, soldCount }
}

async function parseProducts(products: Product[]) {
  if (products.length === 0) return []
  const ids = products.map((p) => p.id)
  const [ratings, sold, stocks] = await Promise.all([
    db.testimonial.groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, isPublished: true, rating: { gte: 4 } },
      _avg: { rating: true },
    }),
    db.order.groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, status: 'paid' },
      _sum: { quantity: true },
    }),
    Promise.all(products.map((p) => (p.sourceId ? countAvailableInventory(p.id, p.sourceId) : p.inStock))),
  ])
  const ratingMap = new Map(ratings.map((r) => [r.productId, r._avg.rating]))
  const soldMap = new Map(sold.map((s) => [s.productId, s._sum.quantity]))
  return products.map((p, i) => {
    const avg = ratingMap.get(p.id)
    return {
      ...p,
      slug: p.slug ?? slugify(p.title),
      inStock: stocks[i],
      rating: avg ? parseFloat(avg.toFixed(1)) : 0,
      soldCount: soldMap.get(p.id) ?? 0,
    }
  })
}

router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20')) || 20))
  const rawSearch = req.query.search as string | undefined
  const search = rawSearch ? rawSearch.slice(0, 100) : undefined

  const where: Prisma.ProductWhereInput = {}
  if (search) where.title = { contains: search }

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  res.json({
    data: await parseProducts(products),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
})

router.get('/stats', async (_req: Request, res: Response) => {
  const [products, ratingAgg] = await Promise.all([
    db.product.findMany({ select: { id: true, sourceId: true, inStock: true } }),
    db.testimonial.aggregate({ where: { isPublished: true, rating: { gte: 4 } }, _avg: { rating: true } }),
  ])

  const stocks = await Promise.all(
    products.map((p) => (p.sourceId ? countAvailableInventory(p.id, p.sourceId) : p.inStock))
  )
  const totalStock = stocks.reduce((sum, n) => sum + n, 0)

  res.json({
    totalListings: products.length,
    totalStock,
    avgRating: ratingAgg._avg.rating ? parseFloat(ratingAgg._avg.rating.toFixed(1)) : 0,
  })
})

router.get('/:id/stocks', async (req: Request, res: Response) => {
  const product = await findProductByIdOrSlug(String(req.params.id))
  if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return }
  if (!product.sourceId) { res.json([]); return }

  const rows = await listInventoryPreview(product.id, product.sourceId)
  res.json(rows.map((s: { id: number; username: string | null; email: string | null; targetFollowers: number | null; year?: string | null }) => ({
    id: s.id,
    username: s.username,
    emailDomain: s.email ? '@' + s.email.split('@')[1] : null,
    hasTwoFactor: false,
    targetFollowers: s.targetFollowers,
    year: s.year ?? null,
  })))
})

router.get('/:id', async (req: Request, res: Response) => {
  const product = await findProductByIdOrSlug(String(req.params.id))

  if (!product) {
    res.status(404).json({ error: 'Produk tidak ditemukan' })
    return
  }

  const parsed = await parseProduct(product)
  const variants = product.sourceId ? await getProductVariants(product.id, product.sourceId) : []
  res.json({ ...parsed, variants })
})

router.post('/', requireAdmin, validate(CreateProductSchema), async (req: Request, res: Response) => {
  const { title, description, inStock, price, rating, isVerified } = req.body

  const product = await db.product.create({
    data: {
      title, description,
      slug: slugify(title),
      inStock: inStock ?? 0,
      price: price ?? 0,
      rating: rating ?? 0,
      isVerified: isVerified ?? false,
    },
  })

  res.status(201).json(await parseProduct(product))
})

router.put('/:id', requireAdmin, validate(UpdateProductSchema), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) {
    res.status(400).json({ error: 'ID tidak valid' })
    return
  }

  const { title, description, inStock, price, rating, isVerified } = req.body

  const product = await db.product.update({
    where: { id },
    data: { title, description, slug: title ? slugify(title) : undefined, inStock, price, rating, isVerified },
  })

  res.json(await parseProduct(product))
})

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) {
    res.status(400).json({ error: 'ID tidak valid' })
    return
  }

  await db.product.delete({ where: { id } })
  res.json({ message: 'Produk dihapus' })
})

export default router
