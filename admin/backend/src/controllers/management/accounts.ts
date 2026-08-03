import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { logger } from '../../utils/logger'
import { AccountsService } from '../../services/management/accountsService'
import db from '../../config/database'
import { encrypt, safeDecrypt } from '../../utils/encrypt'

const prisma = db

type AuthenticatedRequest = Request

export class AccountsController {
  public static async index(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 100
      const skip = (page - 1) * limit

      const sources = await prisma.source.findMany({ orderBy: { id: 'asc' } })
      const sourceIds = sources.map((s) => s.id)

      // Build where clause
      const where: Prisma.AccountWhereInput = { isSold: false }

      if (req.query.source_id && req.query.source_id !== 'all') {
        where.sourceId = parseInt(req.query.source_id as string)
      }

      if (req.query.search) {
        where.OR = [
          { email: { contains: req.query.search as string } },
          { username: { contains: req.query.search as string } },
          { loginApp: { contains: req.query.search as string } },
        ]
      }

      if (req.query.status && req.query.status !== 'all') {
        where.accountStatus = req.query.status as string
      }

      if (req.query.target_followers && req.query.target_followers !== 'all') {
        where.targetFollowers = parseInt(req.query.target_followers as string)
      }

      if (req.query.year && req.query.year !== 'all') {
        where.year = req.query.year as string
      }

      if (req.query.phone_model && req.query.phone_model !== 'all') {
        where.phoneModel = req.query.phone_model as string
      }

      // Get accounts with pagination
      const [accounts, totalCount] = await Promise.all([
        prisma.account.findMany({
          where,
          include: { source: true },
          orderBy: [
            { sourceId: 'asc' },
            { orderIndex: 'asc' },
            { id: 'asc' },
          ],
          skip,
          take: limit,
        }),
        prisma.account.count({ where }),
      ])

      // Get years
      let years: string[] = []
      if (req.query.source_id && req.query.source_id !== 'all') {
        const yearsData = await prisma.account.findMany({
          where: {
            year: { not: null },
            isSold: false,
            sourceId: parseInt(req.query.source_id as string),
          },
          select: { year: true },
          distinct: ['year'],
        })
        years = yearsData
          .map((m) => m.year)
          .filter((m): m is string => m !== null)
      } else {
        const yearsData = await prisma.account.findMany({
          where: { year: { not: null }, isSold: false },
          select: { year: true, sourceId: true },
          distinct: ['year'],
        })
        const groupedBySource: Record<number, string[]> = {}
        yearsData.forEach((m) => {
          if (m.sourceId && m.year) {
            if (!groupedBySource[m.sourceId]) {
              groupedBySource[m.sourceId] = []
            }
            groupedBySource[m.sourceId].push(m.year)
          }
        })
        const addedYears = new Set<string>()
        for (const sourceId of sourceIds) {
          if (groupedBySource[sourceId]) {
            groupedBySource[sourceId].forEach((year) => {
              if (!addedYears.has(year)) {
                years.push(year)
                addedYears.add(year)
              }
            })
          }
        }
      }
      years.sort()

      // Get target followers
      const targetFollowersData = await prisma.account.findMany({
        where: {
          targetFollowers: { not: null },
          isSold: false,
          ...(req.query.source_id && req.query.source_id !== 'all'
            ? { sourceId: parseInt(req.query.source_id as string) }
            : {}),
        },
        select: { targetFollowers: true },
        distinct: ['targetFollowers'],
      })
      const targetFollowers = targetFollowersData
        .map((t) => t.targetFollowers)
        .filter((t): t is number => t !== null)
        .sort((a, b) => a - b)

      // Get stats — same scoping as main query
      const statsWhere: Prisma.AccountWhereInput = { isSold: false }
      if (req.query.source_id && req.query.source_id !== 'all') {
        statsWhere.sourceId = parseInt(req.query.source_id as string)
      }
      if (req.query.search) {
        statsWhere.OR = [
          { email: { contains: req.query.search as string } },
          { username: { contains: req.query.search as string } },
          { loginApp: { contains: req.query.search as string } },
        ]
      }
      if (req.query.status && req.query.status !== 'all') {
        statsWhere.accountStatus = req.query.status as string
      }
      if (req.query.target_followers && req.query.target_followers !== 'all') {
        statsWhere.targetFollowers = parseInt(req.query.target_followers as string)
      }
      if (req.query.year && req.query.year !== 'all') {
        statsWhere.year = req.query.year as string
      }

      const [totalAccounts, totalFollowersSum, totalTargetFollowersSum, completedAccounts, totalCapitalSum] = await Promise.all([
        prisma.account.count({ where: statsWhere }),
        prisma.account.aggregate({
          where: statsWhere,
          _sum: { currentFollowers: true },
        }),
        prisma.account.aggregate({
          where: statsWhere,
          _sum: { targetFollowers: true },
        }),
        prisma.account.count({
          where: { ...statsWhere, accountStatus: 'completed' },
        }),
        prisma.account.aggregate({
          where: statsWhere,
          _sum: { capital: true },
        }),
      ])

      const pagination = {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      }

      res.json({
        accounts: accounts.map((a) => ({ ...a, password: safeDecrypt(a.password), passwordEmail: safeDecrypt(a.passwordEmail), twoFactorAuth: safeDecrypt(a.twoFactorAuth) })),
        sources,
        years,
        targetFollowers,
        pagination,
        stats: {
          total_accounts: totalAccounts,
          total_followers: totalFollowersSum._sum.currentFollowers ?? 0,
          target_followers: totalTargetFollowersSum._sum.targetFollowers ?? 0,
          completed_accounts: completedAccounts,
          total_capital: totalCapitalSum._sum.capital ?? 0,
        },
      })
    } catch (error) {
      logger.error('Error in AccountsController.index:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get accounts' })
    }
  }

  // Grid overview for the "Perangkat" page: one card per phone model with the
  // count of currently active (unsold) accounts stocked on it.
  public static async phoneModels(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const grouped = await prisma.account.groupBy({
        by: ['phoneModel'],
        where: { isSold: false, phoneModel: { not: null } },
        _count: { _all: true },
        orderBy: { phoneModel: 'asc' },
      })

      res.json({
        devices: grouped.map((g) => ({ phone_model: g.phoneModel as string, count: g._count._all })),
      })
    } catch (error) {
      logger.error('Error in AccountsController.phoneModels:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get phone models' })
    }
  }

  public static async exportCompleted(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const where: Prisma.AccountWhereInput = {
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

      if (req.query.target_followers && req.query.target_followers !== 'all') {
        where.targetFollowers = parseInt(req.query.target_followers as string)
      }

      if (req.query.search) {
        where.OR = [
          { email: { contains: req.query.search as string } },
          { username: { contains: req.query.search as string } },
          { loginApp: { contains: req.query.search as string } },
        ]
      }

      const accounts = await prisma.account.findMany({
        where,
        select: { username: true, targetFollowers: true },
        orderBy: [{ targetFollowers: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
      })

      res.json({ accounts })
    } catch (error) {
      logger.error('Error in AccountsController.exportCompleted:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to export accounts' })
    }
  }

  public static async salesMobile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const selectedAccountIds = (req.query.account_ids as string) ?? ''
      const accountIds = selectedAccountIds ? selectedAccountIds.split(',').map((id) => parseInt(id)) : []

      const accounts = await prisma.account.findMany({
        where: {
          id: { in: accountIds },
          isSold: false,
        },
        select: {
          id: true,
          email: true,
          username: true,
          capital: true,
          currentFollowers: true,
          accountStatus: true,
        },
      })

      res.json({
        accounts,
        selectedAccountIds,
      })
    } catch (error) {
      logger.error('Error in AccountsController.salesMobile:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get sales mobile' })
    }
  }

  public static async store(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { order_index, email, username, password, target_followers, current_followers, account_status, login_app, capital, phone_model, source_id, is_sold } = req.body

      const account = await prisma.account.create({
        data: {
          orderIndex: order_index || null,
          email: email || null,
          username: username || null,
          password: password ? encrypt(password) : null,
          targetFollowers: target_followers || 0,
          currentFollowers: current_followers || null,
          accountStatus: account_status || null,
          loginApp: login_app || null,
          capital: capital || null,
          phoneModel: phone_model || null,
          sourceId: source_id ? parseInt(source_id) : null,
          isSold: is_sold || false,
        },
      })

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        account: { ...account, password: safeDecrypt(account.password) },
      })
    } catch (error) {
      logger.error('Error in AccountsController.store:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create account' })
    }
  }

  public static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { order_index, email, username, password, target_followers, current_followers, account_status, login_app, capital, phone_model, source_id, is_sold } = req.body

      const account = await prisma.account.update({
        where: { id: parseInt(id) },
        data: {
          orderIndex: order_index !== undefined ? order_index : undefined,
          email: email !== undefined ? email : undefined,
          username: username !== undefined ? username : undefined,
          password: password !== undefined ? (password ? encrypt(password) : null) : undefined,
          targetFollowers: target_followers !== undefined ? target_followers : undefined,
          currentFollowers: current_followers !== undefined ? current_followers : undefined,
          accountStatus: account_status !== undefined ? account_status : undefined,
          loginApp: login_app !== undefined ? login_app : undefined,
          capital: capital !== undefined ? capital : undefined,
          phoneModel: phone_model !== undefined ? phone_model : undefined,
          sourceId: source_id !== undefined ? (source_id ? parseInt(source_id) : null) : undefined,
          isSold: is_sold !== undefined ? is_sold : undefined,
        },
      })

      res.json({
        success: true,
        message: 'Account updated successfully',
        account: { ...account, password: safeDecrypt(account.password) },
      })
    } catch (error) {
      logger.error('Error in AccountsController.update:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update account' })
    }
  }

  public static async destroy(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params

      const account = await prisma.account.findUnique({
        where: { id: parseInt(id) },
        include: { source: true },
      })

      if (!account) {
        res.status(404).json({ error: 'Account not found' })
        return
      }

      if (account.isSold) {
        res.status(400).json({ error: 'Cannot delete account that has been sold' })
        return
      }

      await prisma.account.delete({
        where: { id: parseInt(id) },
      })

      // Delete from Google Sheets after successful database deletion
      try {
        await AccountsService.deleteAccountFromGoogleSheets(account)
      } catch (gsError) {
        logger.error(`Error deleting account from Google Sheets: ${gsError}`)
        // Don't fail the request if Google Sheets deletion fails
      }

      res.json({
        success: true,
        message: 'Account deleted successfully',
      })
    } catch (error) {
      logger.error('Error in AccountsController.destroy:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete account' })
    }
  }
}
