import { Request, Response } from 'express'
import { logger } from '../../utils/logger'
import db from '../../config/database'

const prisma = db

export const SourcesController = {
  async index(req: Request, res: Response) {
    try {
      const sources = await prisma.source.findMany({ orderBy: { id: 'asc' } })
      res.json({ sources })
    } catch (error) {
      logger.error('Error fetching sources:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch sources' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { name, spreadsheet_id } = req.body

      if (!name || !spreadsheet_id) {
        res.status(400).json({ success: false, error: 'name and spreadsheet_id are required' })
        return
      }

      const source = await prisma.source.create({
        data: { name, spreadsheetId: spreadsheet_id },
      })

      res.status(201).json({ success: true, source })
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        res.status(400).json({ success: false, error: 'Source with that name already exists' })
        return
      }
      logger.error('Error creating source:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create source' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, spreadsheet_id } = req.body

      if (!name || !spreadsheet_id) {
        res.status(400).json({ success: false, error: 'name and spreadsheet_id are required' })
        return
      }

      const source = await prisma.source.update({
        where: { id: parseInt(id) },
        data: { name, spreadsheetId: spreadsheet_id },
      })

      res.json({ success: true, source })
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        res.status(400).json({ success: false, error: 'Source with that name already exists' })
        return
      }
      logger.error('Error updating source:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update source' })
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params
      await prisma.source.delete({ where: { id: parseInt(id) } })
      res.json({ success: true, message: 'Source deleted successfully' })
    } catch (error) {
      logger.error('Error deleting source:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete source' })
    }
  },
}
