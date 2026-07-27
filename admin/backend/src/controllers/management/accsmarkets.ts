import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import db from '../../config/database'
import { logger } from '../../utils/logger'
import { AccsmarketsService } from '../../services/management/accsmarketsService'
import { encrypt, safeDecrypt } from '../../utils/encrypt'

const prisma = db

function decryptAccsmarket<T extends { password: string | null; passwordEmail: string | null; twoFactorAuth: string | null }>(a: T) {
  return { ...a, password: safeDecrypt(a.password), passwordEmail: safeDecrypt(a.passwordEmail), twoFactorAuth: safeDecrypt(a.twoFactorAuth) }
}

export const AccsmarketsController = {
  async index(req: Request, res: Response) {
    try {
      const searchQuery = req.query.search as string
      const statusFilter = req.query.status as string
      const followersFilter = req.query.followers as string
      const yearFilter = req.query.year as string
      const sourceIdFilter = req.query.source_id as string
      const page = parseInt(req.query.page as string) || 1
      const limit = 100

      let where: Prisma.AccsmarketWhereInput = { isSold: false }

      if (searchQuery) {
        where.OR = [{ email: { contains: searchQuery } }, { username: { contains: searchQuery } }]
      }

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'progress') {
          where.AND = [{ currentFollowers: { lt: prisma.accsmarket.fields.targetFollowers } }]
        } else {
          where.accountStatus = statusFilter
        }
      }

      if (followersFilter && followersFilter !== 'all') {
        where.targetFollowers = parseInt(followersFilter)
      }

      if (yearFilter && yearFilter !== 'all') {
        where.year = yearFilter
      }

      if (sourceIdFilter && sourceIdFilter !== 'all') {
        where.sourceId = parseInt(sourceIdFilter)
      }

      // Only query accsmarket sources
      const accsmarketSources = await prisma.source.findMany({
        where: { isAccsmarket: true },
        orderBy: [{ id: 'asc' }],
      })
      const accsmarketSourceIds = accsmarketSources.map((s) => s.id)
      if (accsmarketSourceIds.length > 0 && !where.sourceId) {
        where.sourceId = { in: accsmarketSourceIds }
      }

      const accsmarkets = await prisma.accsmarket.findMany({
        where,
        include: { source: true },
        orderBy: [{ source: { name: 'asc' } }, { orderIndex: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      })

      const yearsRaw = await prisma.accsmarket.findMany({
        where: { year: { not: null }, isSold: false },
        select: { year: true, sourceId: true },
        distinct: ['year'],
      })

      let years: string[] = []
      const sourceIdVal = sourceIdFilter && sourceIdFilter !== 'all' ? parseInt(sourceIdFilter) : null

      if (sourceIdVal) {
        years = yearsRaw.filter((y) => y.sourceId === sourceIdVal).map((y) => y.year).filter(Boolean) as string[]
      } else {
        const added = new Set<string>()
        yearsRaw.forEach((y) => { if (y.year && !added.has(y.year)) { years.push(y.year); added.add(y.year) } })
      }
      years = years.filter((y): y is string => typeof y === 'string' && y.length > 0)
      years.sort((a, b) => b.localeCompare(a))

      const targetFollowersData = await prisma.accsmarket.findMany({
        where: { targetFollowers: { not: null }, isSold: false, ...(sourceIdVal && { sourceId: sourceIdVal }) },
        select: { targetFollowers: true },
        distinct: ['targetFollowers'],
      })
      const targetFollowers = targetFollowersData.map((t) => t.targetFollowers).filter((t) => t !== null) as number[]
      targetFollowers.sort((a, b) => a - b)

      const customers = await prisma.customer.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      })

      const statsWhere = { isSold: false, ...where }
      const totalAccounts = await prisma.accsmarket.count({ where: statsWhere })
      const targetFollowersSum = await prisma.accsmarket.aggregate({
        where: statsWhere,
        _sum: { targetFollowers: true },
      })
      const totalFollowers = targetFollowersSum._sum.targetFollowers || 0
      const completedAccounts = await prisma.accsmarket.count({
        where: { ...statsWhere, accountStatus: 'completed' },
      })

      res.json({
        accsmarkets: accsmarkets.map(decryptAccsmarket),
        sources: accsmarketSources,
        targetFollowers,
        years,
        customers,
        stats: {
          total_accounts: totalAccounts,
          total_followers: totalFollowers,
          followers: totalFollowers,
          completed_accounts: completedAccounts,
        },
      })
    } catch (error) {
      logger.error('Error in accsmarkets index:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
    }
  },

  async history(req: Request, res: Response) {
    try {
      const searchQuery = req.query.search as string
      const statusFilter = req.query.status as string
      const followersFilter = req.query.followers as string
      const yearFilter = req.query.year as string
      const sourceIdFilter = req.query.source_id as string
      const page = parseInt(req.query.page as string) || 1
      const limit = 100

      let where: Prisma.AccsmarketWhereInput = { isSold: true }

      if (searchQuery) {
        where.OR = [{ email: { contains: searchQuery } }, { username: { contains: searchQuery } }]
      }

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'progress') {
          where.AND = [{ currentFollowers: { lt: prisma.accsmarket.fields.targetFollowers } }]
        } else {
          where.accountStatus = statusFilter
        }
      }

      if (followersFilter && followersFilter !== 'all') {
        where.targetFollowers = parseInt(followersFilter)
      }

      if (yearFilter && yearFilter !== 'all') {
        where.year = yearFilter
      }

      if (sourceIdFilter && sourceIdFilter !== 'all') {
        where.sourceId = parseInt(sourceIdFilter)
      }

      const accsmarkets = await prisma.accsmarket.findMany({
        where,
        include: { source: true },
        orderBy: [{ source: { name: 'asc' } }, { orderIndex: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      })

      const sources = await prisma.source.findMany({
        orderBy: [{ id: 'asc' }],
      })

      const yearsRaw = await prisma.accsmarket.findMany({
        where: { year: { not: null }, isSold: true },
        select: { year: true, sourceId: true },
        distinct: ['year'],
      })

      let years: string[] = []
      const sourceIdVal = sourceIdFilter && sourceIdFilter !== 'all' ? parseInt(sourceIdFilter) : null

      if (sourceIdVal) {
        years = yearsRaw.filter((y) => y.sourceId === sourceIdVal).map((y) => y.year).filter(Boolean) as string[]
      } else {
        years = [...new Set(yearsRaw.map((y) => y.year).filter(Boolean))] as string[]
      }
      years = years.filter((y): y is string => typeof y === 'string' && y.length > 0)
      years.sort((a, b) => b.localeCompare(a))

      const targetFollowersData = await prisma.accsmarket.findMany({
        where: { targetFollowers: { not: null }, isSold: true, ...(sourceIdVal && { sourceId: sourceIdVal }) },
        select: { targetFollowers: true },
        distinct: ['targetFollowers'],
      })
      const targetFollowers = targetFollowersData.map((t) => t.targetFollowers).filter((t) => t !== null) as number[]
      targetFollowers.sort((a, b) => a - b)

      const statsWhere = { isSold: true, ...where }
      const totalAccounts = await prisma.accsmarket.count({ where: statsWhere })
      const targetFollowersSum = await prisma.accsmarket.aggregate({
        where: statsWhere,
        _sum: { targetFollowers: true },
      })
      const totalFollowers = targetFollowersSum._sum.targetFollowers || 0
      const completedAccounts = await prisma.accsmarket.count({
        where: { ...statsWhere, accountStatus: 'completed' },
      })

      res.json({
        accsmarkets: accsmarkets.map(decryptAccsmarket),
        sources,
        targetFollowers,
        years,
        stats: {
          total_accounts: totalAccounts,
          total_followers: totalFollowers,
          followers: totalFollowers,
          completed_accounts: completedAccounts,
        },
      })
    } catch (error) {
      logger.error('Error in accsmarkets history:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
    }
  },

  async exportCompleted(req: Request, res: Response) {
    try {
      const where: Prisma.AccsmarketWhereInput = {
        isSold: false,
        accountStatus: 'completed',
        username: { not: null },
      }

      if (req.query.source_id && req.query.source_id !== 'all') {
        where.sourceId = parseInt(req.query.source_id as string)
      }

      if (req.query.year && req.query.year !== 'all') {
        where.year = req.query.year as string
      }

      if (req.query.followers && req.query.followers !== 'all') {
        where.targetFollowers = parseInt(req.query.followers as string)
      }

      if (req.query.search) {
        where.OR = [
          { email: { contains: req.query.search as string } },
          { username: { contains: req.query.search as string } },
        ]
      }

      const accsmarkets = await prisma.accsmarket.findMany({
        where,
        select: { username: true, targetFollowers: true, year: true, source: { select: { name: true } } },
        orderBy: [{ targetFollowers: 'asc' }, { year: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
      })

      res.json({ accsmarkets })
    } catch (error) {
      logger.error('Error in AccsmarketsController.exportCompleted:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to export accsmarkets' })
    }
  },

  async salesMobile(req: Request, res: Response) {
    try {
      const selectedAccountIds = req.query.account_ids as string
      const accountIds = selectedAccountIds ? selectedAccountIds.split(',').map(Number) : []

      const accsmarkets = await prisma.accsmarket.findMany({
        where: { id: { in: accountIds }, isSold: false },
        select: {
          id: true,
          email: true,
          passwordEmail: true,
          username: true,
          password: true,
          twoFactorAuth: true,
          capital: true,
          targetFollowers: true,
          accountStatus: true,
          year: true,
        },
      })

      const customers = await prisma.customer.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      })

      res.json({
        accsmarkets: accsmarkets.map(decryptAccsmarket),
        customers,
        selectedAccountIds,
      })
    } catch (error) {
      logger.error('Error in salesMobile:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const {
        order_index,
        email,
        password_email,
        username,
        password,
        two_factor_auth,
        target_followers,
        account_status,
        capital,
        year,
        source_id,
        is_sold,
      } = req.body

      const accsmarket = await prisma.accsmarket.create({
        data: {
          orderIndex: order_index,
          email: email || null,
          passwordEmail: password_email ? encrypt(password_email) : null,
          username: username || null,
          password: password ? encrypt(password) : null,
          twoFactorAuth: two_factor_auth ? encrypt(two_factor_auth) : null,
          targetFollowers: target_followers,
          accountStatus: account_status,
          capital: capital,
          year: year || null,
          sourceId: source_id,
          isSold: is_sold || false,
        },
      })

      res.status(201).json({ success: true, accsmarket: decryptAccsmarket(accsmarket) })
    } catch (error) {
      logger.error('Error creating accsmarket:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Email or username already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create accsmarket' })
      }
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const {
        order_index,
        email,
        password_email,
        username,
        password,
        two_factor_auth,
        target_followers,
        account_status,
        capital,
        year,
        source_id,
        is_sold,
      } = req.body

      const accsmarket = await prisma.accsmarket.update({
        where: { id: parseInt(id) },
        data: {
          orderIndex: order_index,
          email: email || null,
          passwordEmail: password_email ? encrypt(password_email) : null,
          username: username || null,
          password: password ? encrypt(password) : null,
          twoFactorAuth: two_factor_auth ? encrypt(two_factor_auth) : null,
          targetFollowers: target_followers,
          accountStatus: account_status,
          capital: capital,
          year: year || null,
          sourceId: source_id,
          isSold: is_sold || false,
        },
      })

      res.json({ success: true, accsmarket: decryptAccsmarket(accsmarket) })
    } catch (error) {
      logger.error('Error updating accsmarket:', error)
      if ((error as { code?: string }).code === 'P2002') {
        res.status(400).json({ error: 'Email or username already exists' })
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update accsmarket' })
      }
    }
  },

  async destroy(req: Request, res: Response) {
    const accsmarket = await prisma.accsmarket.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { source: true },
    })

    if (!accsmarket) {
      return res.status(404).json({ error: 'Accsmarket not found' })
    }

    if (accsmarket.isSold) {
      return res.status(400).json({ error: 'Cannot delete account that has been sold' })
    }

    try {
      await prisma.accsmarket.delete({
        where: { id: parseInt(req.params.id) },
      })

      try {
        await AccsmarketsService.deleteAccountFromGoogleSheets(accsmarket)
      } catch (error) {
        logger.error('Error deleting from Google Sheets:', error)
      }

      res.json({ success: true, message: 'Account deleted successfully' })
    } catch (error) {
      logger.error('Error deleting accsmarket:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete accsmarket' })
    }
  },
}
