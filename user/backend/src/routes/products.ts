import { Router, Request, Response } from 'express'
import { Prisma, Product } from '@prisma/client'
import db from '../config/database'
import { requireAdmin } from '../middleware/auth'
import { countAvailableInventory, listInventoryPreview, getProductVariants } from '../utils/inventory'

const router = Router()

async function parseProduct(p: Product) {
  const inStock = p.sourceId ? await countAvailableInventory(p.id, p.sourceId) : p.inStock
  return { ...p, inStock }
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
    data: await Promise.all(products.map(parseProduct)),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
})

router.get('/stats', async (_req: Request, res: Response) => {
  const [totalListings, stockAgg, ratingAgg] = await Promise.all([
    db.product.count(),
    db.product.aggregate({ _sum: { inStock: true } }),
    db.product.aggregate({ _avg: { rating: true } }),
  ])

  res.json({
    totalListings,
    totalStock: stockAgg._sum.inStock ?? 0,
    avgRating: ratingAgg._avg.rating ? parseFloat(ratingAgg._avg.rating.toFixed(1)) : 0,
  })
})

router.get('/:id/stocks', async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) { res.status(400).json({ error: 'ID tidak valid' }); return }

  const product = await db.product.findUnique({ where: { id }, select: { sourceId: true } })
  if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return }
  if (!product.sourceId) { res.json([]); return }

  const rows = await listInventoryPreview(id, product.sourceId)
  res.json(rows.map((s: { id: number; username: string | null; email: string | null; targetFollowers: number | null }) => ({
    id: s.id,
    username: s.username,
    emailDomain: s.email ? '@' + s.email.split('@')[1] : null,
    hasTwoFactor: false,
    targetFollowers: s.targetFollowers,
  })))
})

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) {
    res.status(400).json({ error: 'ID tidak valid' })
    return
  }

  const product = await db.product.findUnique({ where: { id } })

  if (!product) {
    res.status(404).json({ error: 'Produk tidak ditemukan' })
    return
  }

  const parsed = await parseProduct(product)
  const variants = product.sourceId ? await getProductVariants(id, product.sourceId) : []
  res.json({ ...parsed, variants })
})

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { title, description, inStock, price, rating, isVerified } = req.body

  if (!title || !description) {
    res.status(400).json({ error: 'title dan description wajib diisi' })
    return
  }

  const product = await db.product.create({
    data: {
      title, description,
      inStock: inStock ?? 0,
      price: price ?? 0,
      rating: rating ?? 0,
      isVerified: isVerified ?? false,
    },
  })

  res.status(201).json(await parseProduct(product))
})

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) {
    res.status(400).json({ error: 'ID tidak valid' })
    return
  }

  const { title, description, inStock, price, rating, isVerified } = req.body

  const product = await db.product.update({
    where: { id },
    data: { title, description, inStock, price, rating, isVerified },
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
