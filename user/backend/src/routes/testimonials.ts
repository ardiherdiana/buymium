import { Router, Request, Response } from 'express'
import db from '../config/database'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const rawProductId = req.query.productId as string | undefined
  const productId = rawProductId ? parseInt(rawProductId) : undefined

  const rawLimit = parseInt(String(req.query.limit || '10'))
  const limit = Math.min(20, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit))

  if (rawProductId !== undefined && (productId === undefined || isNaN(productId))) {
    res.status(400).json({ error: 'productId tidak valid' })
    return
  }

  const where: { isPublished: boolean; rating: { gte: number }; productId?: number } = { isPublished: true, rating: { gte: 4 } }
  if (productId !== undefined) {
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

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!
  const { orderId, rating, message } = req.body as { orderId?: number; rating?: number; message?: string }

  const parsedOrderId = orderId ? parseInt(String(orderId)) : NaN
  const parsedRating = rating !== undefined ? parseInt(String(rating)) : NaN

  if (!parsedOrderId || isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5 || !message?.trim()) {
    res.status(400).json({ error: 'orderId, rating (1-5), dan message wajib diisi' })
    return
  }

  const order = await db.order.findUnique({ where: { id: parsedOrderId } })
  if (!order || order.userId !== userId) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan' })
    return
  }
  if (order.status !== 'paid') {
    res.status(400).json({ error: 'Ulasan hanya bisa diberikan untuk pesanan yang sudah lunas' })
    return
  }

  const existing = await db.testimonial.findUnique({ where: { orderId: parsedOrderId } })
  if (existing) {
    res.status(400).json({ error: 'Pesanan ini sudah diberi ulasan' })
    return
  }

  const user = await db.user.findUnique({ where: { id: userId } })

  const testimonial = await db.testimonial.create({
    data: {
      productId: order.productId,
      createdById: userId,
      orderId: parsedOrderId,
      customerName: user?.name || 'Pelanggan',
      message: message.trim(),
      rating: parsedRating,
      isPublished: parsedRating >= 4,
    },
  })

  res.status(201).json(testimonial)
})

export default router
