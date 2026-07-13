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

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      const { isPublished } = req.body

      const data: Record<string, unknown> = {}
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
