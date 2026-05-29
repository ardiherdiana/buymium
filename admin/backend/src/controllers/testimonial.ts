import { Request, Response } from 'express'
import { TestimonialService } from '../services/testimonial'

export class TestimonialController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const productId = req.query.productId ? parseInt(String(req.query.productId)) : undefined
      const testimonials = await TestimonialService.getAll(productId)
      res.json(testimonials)
    } catch (err) {
      console.error('[Testimonials List Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch testimonials' })
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { productId, customerName, message, rating, avatar, isPublished } = req.body
      const createdById = req.user!.userId

      if (!productId || !customerName || !message) {
        res.status(400).json({ success: false, error: 'productId, customerName, and message are required' })
        return
      }

      const testimonial = await TestimonialService.create({
        productId: parseInt(String(productId)),
        createdById,
        customerName,
        message,
        rating: rating !== undefined ? parseInt(String(rating)) : 5,
        avatar: avatar || undefined,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      })

      res.status(201).json(testimonial)
    } catch (err) {
      console.error('[Testimonial Create Error]', err)
      res.status(500).json({ success: false, error: 'Failed to create testimonial' })
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      const { productId, customerName, message, rating, avatar, isPublished } = req.body

      const data: Record<string, unknown> = {}
      if (productId !== undefined) data.productId = parseInt(String(productId))
      if (customerName !== undefined) data.customerName = customerName
      if (message !== undefined) data.message = message
      if (rating !== undefined) data.rating = parseInt(String(rating))
      if (avatar !== undefined) data.avatar = avatar
      if (isPublished !== undefined) data.isPublished = Boolean(isPublished)

      const testimonial = await TestimonialService.update(id, data)
      res.json(testimonial)
    } catch (err) {
      console.error('[Testimonial Update Error]', err)
      res.status(500).json({ success: false, error: 'Failed to update testimonial' })
    }
  }

  static async destroy(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      await TestimonialService.remove(id)
      res.json({ message: 'Testimonial deleted successfully' })
    } catch (err) {
      console.error('[Testimonial Delete Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete testimonial' })
    }
  }
}
