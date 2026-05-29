import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'
import { logger } from '../../utils/logger'
import * as fs from 'fs'
import * as path from 'path'

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

      const sourcesWithImageUrl = sources.map((source) => ({
        id: source.id,
        name: source.name,
        index: source.index,
        prefix: source.prefix,
        color: source.color,
        spreadsheet_id: source.spreadsheetId,
        is_accsmarket: source.isAccsmarket,
        image_url: source.image ? `/storage/sources/${path.basename(source.image)}` : null,
        created_at: source.createdAt,
        updated_at: source.updatedAt,
      }))

      const total = await prisma.source.count()

      res.json({
        sources: sourcesWithImageUrl,
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
      const { name, spreadsheet_id, color, prefix, is_accsmarket } = req.body

      if (!name || !spreadsheet_id) {
        return res.status(400).json({ error: 'Name and spreadsheet_id are required' })
      }

      let imagePath: string | null = null
      if (req.file) {
        imagePath = `sources/${req.file.filename}`
      }

      const source = await prisma.source.create({
        data: {
          name,
          spreadsheetId: spreadsheet_id,
          image: imagePath,
          color: color || null,
          prefix: prefix || null,
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
          prefix: source.prefix,
          color: source.color,
          spreadsheet_id: source.spreadsheetId,
          is_accsmarket: source.isAccsmarket,
          image_url: source.image ? `/storage/sources/${path.basename(source.image)}` : null,
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
      const { name, spreadsheet_id, index, color, prefix, is_accsmarket } = req.body

      if (!name || !spreadsheet_id) {
        return res.status(400).json({ error: 'Name and spreadsheet_id are required' })
      }

      const existingSource = await prisma.source.findUnique({
        where: { id: parseInt(id) },
      })

      let imagePath = existingSource?.image

      if (req.file) {
        if (existingSource?.image) {
          try {
            const oldPath = path.join(process.cwd(), 'admin/backend/uploads', existingSource.image)
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath)
            }
          } catch (error) {
            logger.error('Error deleting old image:', error)
          }
        }
        imagePath = `sources/${req.file.filename}`
      }

      const updateData: Prisma.SourceUpdateInput = {
        name,
        spreadsheetId: spreadsheet_id,
        color: color || null,
        prefix: prefix || null,
        isAccsmarket: is_accsmarket === 'true' || is_accsmarket === true,
        ...(index !== undefined && { index }),
      }

      if (req.file) {
        updateData.image = imagePath
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
          prefix: source.prefix,
          color: source.color,
          spreadsheet_id: source.spreadsheetId,
          is_accsmarket: source.isAccsmarket,
          image_url: source.image ? `/storage/sources/${path.basename(source.image)}` : null,
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

      const source = await prisma.source.findUnique({
        where: { id: parseInt(id) },
      })

      if (source?.image) {
        try {
          const imagePath = path.join(process.cwd(), 'admin/backend/uploads', source.image)
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath)
          }
        } catch (error) {
          logger.error('Error deleting image:', error)
        }
      }

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
