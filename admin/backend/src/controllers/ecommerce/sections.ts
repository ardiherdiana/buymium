import { Request, Response } from 'express'
import db from '../../config/database'

export class SectionsController {
  static async index(_req: Request, res: Response): Promise<void> {
    try {
      const sections = await db.productSection.findMany({
        orderBy: { order: 'asc' },
        include: {
          products: { orderBy: { createdAt: 'asc' } },
        },
      })
      res.json(sections)
    } catch (err) {
      console.error('[Sections List Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch sections' })
    }
  }

  static async show(req: Request, res: Response): Promise<void> {
    try {
      const section = await db.productSection.findUnique({
        where: { id: String(req.params.id) },
        include: { products: { orderBy: { createdAt: 'asc' } } },
      })
      if (!section) {
        res.status(404).json({ success: false, error: 'Section tidak ditemukan' })
        return
      }
      res.json(section)
    } catch (err) {
      console.error('[Section Detail Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch section' })
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { id, title, subtitle, order } = req.body
      const section = await db.productSection.create({
        data: { id, title, subtitle: subtitle || '', order: order ?? 0 },
      })
      res.status(201).json(section)
    } catch (err) {
      console.error('[Create Section Error]', err)
      res.status(500).json({ success: false, error: 'Failed to create section' })
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { title, subtitle, order } = req.body
      const section = await db.productSection.update({
        where: { id: String(req.params.id) },
        data: { title, subtitle, order },
      })
      res.json(section)
    } catch (err) {
      console.error('[Update Section Error]', err)
      res.status(500).json({ success: false, error: 'Failed to update section' })
    }
  }

  static async destroy(req: Request, res: Response): Promise<void> {
    try {
      await db.productSection.delete({ where: { id: String(req.params.id) } })
      res.json({ message: 'Section dihapus' })
    } catch (err) {
      console.error('[Delete Section Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete section' })
    }
  }
}
