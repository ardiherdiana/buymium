import { Router, Request, Response } from 'express'
import { Prisma, Product } from '@prisma/client'
import db from '../config/database'
import { requireAdmin } from '../middleware/auth'

const router = Router()

function parseProduct(p: Product & { section?: any }) {
  return {
    ...p,
    tags: (() => { try { return JSON.parse(p.tags) } catch { return [] } })(),
  }
}

router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20')) || 20))
  const sectionId = req.query.sectionId as string | undefined
  const rawSearch = req.query.search as string | undefined
  const search = rawSearch ? rawSearch.slice(0, 100) : undefined

  const where: Prisma.ProductWhereInput = {}
  if (sectionId) where.sectionId = sectionId
  if (search) where.title = { contains: search }

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: { section: true },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  res.json({
    data: products.map(parseProduct),
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

  const stocks = await db.stock.findMany({
    where: { productId: id, status: 'available' },
    select: { id: true, username: true, email: true, twoFactorCode: true },
    orderBy: { id: 'asc' },
  })

  res.json(stocks.map(s => ({
    id: s.id,
    username: s.username,
    emailDomain: s.email ? '@' + s.email.split('@')[1] : null,
    hasTwoFactor: !!s.twoFactorCode,
  })))
})

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) {
    res.status(400).json({ error: 'ID tidak valid' })
    return
  }

  const product = await db.product.findUnique({
    where: { id },
    include: { section: true },
  })

  if (!product) {
    res.status(404).json({ error: 'Produk tidak ditemukan' })
    return
  }

  res.json(parseProduct(product))
})

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const {
    title, description, inStock, price,
    rating, isVerified, tags, sectionId,
  } = req.body

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
      tags: Array.isArray(tags) ? JSON.stringify(tags) : (tags ?? '[]'),
      sectionId: sectionId || null,
    },
  })

  res.status(201).json(parseProduct(product))
})

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id))
  if (isNaN(id)) {
    res.status(400).json({ error: 'ID tidak valid' })
    return
  }

  const {
    title, description, inStock, price,
    rating, isVerified, tags, sectionId,
  } = req.body

  const product = await db.product.update({
    where: { id },
    data: {
      title, description, inStock, price,
      rating, isVerified,
      tags: Array.isArray(tags) ? JSON.stringify(tags) : tags,
      sectionId: sectionId || null,
    },
  })

  res.json(parseProduct(product))
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
