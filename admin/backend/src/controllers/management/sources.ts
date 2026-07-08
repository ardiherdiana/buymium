import { Request, Response } from 'express'
import db from '../../config/database'
import { logger } from '../../utils/logger'

const prisma = db

export const SourcesController = {
  async index(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 15
      const search = req.query.search as string | undefined

      const where = search ? { name: { contains: search } } : {}

      const sources = await prisma.source.findMany({
        where,
        include: { product: { select: { id: true, title: true } } },
        orderBy: [{ id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      })

      const sourcesWithMeta = sources.map((source) => ({
        id: source.id,
        name: source.name,
        spreadsheet_id: source.spreadsheetId,
        is_accsmarket: source.isAccsmarket,
        product: source.product,
        created_at: source.createdAt,
        updated_at: source.updatedAt,
      }))

      const total = await prisma.source.count({ where })

      res.json({
        sources: sourcesWithMeta,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('Error fetching sources:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch sources' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { name, spreadsheet_id, is_accsmarket } = req.body

      if (!name || !spreadsheet_id) {
        return res.status(400).json({ error: 'Name and spreadsheet_id are required' })
      }

      const source = await prisma.source.create({
        data: {
          name,
          spreadsheetId: spreadsheet_id,
          isAccsmarket: is_accsmarket === 'true' || is_accsmarket === true,
        },
      })

      res.status(201).json({
        success: true,
        source: {
          id: source.id,
          name: source.name,
          spreadsheet_id: source.spreadsheetId,
          is_accsmarket: source.isAccsmarket,
          created_at: source.createdAt,
          updated_at: source.updatedAt,
        },
      })
    } catch (error) {
      logger.error('Error creating source:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Source name or spreadsheet_id already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create source' })
      }
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, spreadsheet_id, is_accsmarket } = req.body

      if (!name || !spreadsheet_id) {
        return res.status(400).json({ error: 'Name and spreadsheet_id are required' })
      }

      const source = await prisma.source.update({
        where: { id: parseInt(id) },
        data: {
          name,
          spreadsheetId: spreadsheet_id,
          isAccsmarket: is_accsmarket === 'true' || is_accsmarket === true,
        },
      })

      res.json({
        success: true,
        source: {
          id: source.id,
          name: source.name,
          spreadsheet_id: source.spreadsheetId,
          is_accsmarket: source.isAccsmarket,
          created_at: source.createdAt,
          updated_at: source.updatedAt,
        },
      })
    } catch (error) {
      logger.error('Error updating source:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Source name or spreadsheet_id already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update source' })
      }
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params

      await prisma.source.delete({
        where: { id: parseInt(id) },
      })

      res.json({ success: true, message: 'Source deleted successfully' })
    } catch (error) {
      logger.error('Error deleting source:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete source' })
    }
  },
}
