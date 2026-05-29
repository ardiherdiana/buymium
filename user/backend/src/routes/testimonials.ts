import { Router, Request, Response } from 'express'
import db from '../config/database'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const rawProductId = req.query.productId as string | undefined
  const productId = rawProductId ? parseInt(rawProductId) : undefined

  const rawLimit = parseInt(String(req.query.limit || '10'))
  const limit = Math.min(20, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit))

  const where: { isPublished: boolean; productId?: number } = { isPublished: true }
  if (productId !== undefined && !isNaN(productId)) {
    where.productId = productId
  }

  const testimonials = await db.testimonial.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      product: {
        select: { id: true, title: true },
      },
    },
  })

  res.json(testimonials)
})

export default router
