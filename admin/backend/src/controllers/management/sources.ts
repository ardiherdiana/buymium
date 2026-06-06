import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'
import { logger } from '../../utils/logger'

const prisma = db

export const SourcesController = {
  async index(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 15

      const sources = await prisma.source.findMany({
        orderBy: [{ index: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      })

      const sourcesWithMeta = sources.map((source) => ({
        id: source.id,
        name: source.name,
        index: source.index,
        spreadsheet_id: source.spreadsheetId,
        is_accsmarket: source.isAccsmarket,
        created_at: source.createdAt,
        updated_at: source.updatedAt,
      }))

      const total = await prisma.source.count()

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
          index: 0,
          isAccsmarket: is_accsmarket === 'true' || is_accsmarket === true,
        },
      })

      res.status(201).json({
        success: true,
        source: {
          id: source.id,
          name: source.name,
          index: source.index,
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
      const { name, spreadsheet_id, index, is_accsmarket } = req.body

      if (!name || !spreadsheet_id) {
        return res.status(400).json({ error: 'Name and spreadsheet_id are required' })
      }

      const updateData: Prisma.SourceUpdateInput = {
        name,
        spreadsheetId: spreadsheet_id,
        isAccsmarket: is_accsmarket === 'true' || is_accsmarket === true,
        ...(index !== undefined && { index }),
      }

      const source = await prisma.source.update({
        where: { id: parseInt(id) },
        data: updateData,
      })

      res.json({
        success: true,
        source: {
          id: source.id,
          name: source.name,
          index: source.index,
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
