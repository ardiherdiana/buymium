import { Request, Response } from 'express'
import { logger } from '../../utils/logger'
import db from '../../config/database'
import { JobService } from '../../services/management/jobService'

const prisma = db

export const JobSourcesController = {
  async index(req: Request, res: Response) {
    try {
      const sources = await prisma.jobSource.findMany({
        orderBy: { id: 'asc' },
        include: { _count: { select: { accounts: true } } },
      })
      res.json({
        sources: sources.map((s) => ({
          id: s.id,
          name: s.name,
          spreadsheetId: s.spreadsheetId,
          accountsCount: s._count.accounts,
        })),
      })
    } catch (error) {
      logger.error('Error fetching job sources:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch job sources' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { name, spreadsheet_id } = req.body

      if (!name || !spreadsheet_id) {
        res.status(400).json({ success: false, error: 'name and spreadsheet_id are required' })
        return
      }

      const source = await prisma.jobSource.create({
        data: { name, spreadsheetId: spreadsheet_id },
      })

      res.status(201).json({ success: true, source })
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        res.status(400).json({ success: false, error: 'Job source with that name already exists' })
        return
      }
      logger.error('Error creating job source:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create job source' })
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

      const source = await prisma.jobSource.update({
        where: { id: parseInt(id) },
        data: { name, spreadsheetId: spreadsheet_id },
      })

      res.json({ success: true, source })
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        res.status(400).json({ success: false, error: 'Job source with that name already exists' })
        return
      }
      logger.error('Error updating job source:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update job source' })
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params
      await prisma.jobSource.delete({ where: { id: parseInt(id) } })
      res.json({ success: true, message: 'Job source deleted successfully' })
    } catch (error) {
      logger.error('Error deleting job source:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete job source' })
    }
  },

  async sync(req: Request, res: Response) {
    try {
      const result = await JobService.syncAll()
      res.json({ success: true, ...result })
    } catch (error) {
      logger.error('Error syncing job sources:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to sync job sources' })
    }
  },
}
