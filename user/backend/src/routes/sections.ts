import { Router, Request, Response } from 'express'
import { Prisma, Product, ProductSection } from '@prisma/client'
import db from '../config/database'
import { requireAdmin } from '../middleware/auth'

const router = Router()

type SectionWithProducts = ProductSection & { products: Product[] }

function parseProduct(p: Product) {
  return {
    ...p,
    tags: (() => { try { return JSON.parse(p.tags) } catch { return [] } })(),
  }
}

router.get('/', async (_req: Request, res: Response) => {
  const sections = await db.productSection.findMany({
    orderBy: { order: 'asc' },
    include: {
      products: {
        orderBy: { createdAt: 'asc' },
      },
    },
  }) as unknown as SectionWithProducts[]

  const result = sections.map(s => ({
    ...s,
    listings: s.products.map(parseProduct),
    products: undefined,
  }))

  res.json(result)
})

router.get('/:id', async (req: Request, res: Response) => {
  const section = await db.productSection.findUnique({
    where: { id: String(req.params.id) },
    include: { products: { orderBy: { createdAt: 'asc' } } },
  }) as unknown as SectionWithProducts | null

  if (!section) {
    res.status(404).json({ error: 'Section tidak ditemukan' })
    return
  }

  res.json({ ...section, listings: section.products.map(parseProduct), products: undefined })
})

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { id, title, subtitle, order } = req.body
  if (!id || !title) {
    res.status(400).json({ error: 'id dan title wajib diisi' })
    return
  }

  const section = await db.productSection.create({
    data: { id, title, subtitle: subtitle || '', order: order ?? 0 },
  })
  res.status(201).json(section)
})

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  const { title, subtitle, order } = req.body
  const section = await db.productSection.update({
    where: { id: String(req.params.id) },
    data: { title, subtitle, order },
  })
  res.json(section)
})

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  await db.productSection.delete({ where: { id: String(req.params.id) } })
  res.json({ message: 'Section dihapus' })
})

export default router
