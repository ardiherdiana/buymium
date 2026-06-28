import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { logger } from '../../utils/logger'
import { AccountsService } from '../../services/management/accountsService'
import db from '../../config/database'

const prisma = db

type AuthenticatedRequest = Request

export class AccountsController {
  public static async index(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 100
      const skip = (page - 1) * limit

      // Get sources (only non-accsmarket sources) — used for filter options and scoping the list
      const nonAccsmarketSources = await prisma.source.findMany({
        where: { isAccsmarket: false },
        orderBy: [{ id: 'asc' }],
      })
      const nonAccsmarketSourceIds = nonAccsmarketSources.map((s) => s.id)

      // Build where clause
      const where: Prisma.AccountWhereInput = { isSold: false }

      if (req.query.source_id && req.query.source_id !== 'all') {
        where.sourceId = parseInt(req.query.source_id as string)
      } else {
        where.sourceId = { in: nonAccsmarketSourceIds }
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

      if (req.query.phone_model && req.query.phone_model !== 'all') {
        where.phoneModel = req.query.phone_model as string
      }

      // Get accounts with pagination
      const [accounts, totalCount] = await Promise.all([
        prisma.account.findMany({
          where,
          include: { source: true },
          orderBy: [
            { source: { name: 'asc' } },
            { orderIndex: 'asc' },
            { id: 'asc' },
          ],
          skip,
          take: limit,
        }),
        prisma.account.count({ where }),
      ])

      const sources = nonAccsmarketSources

      // Get phone models
      let phoneModels: string[] = []
      if (req.query.source_id && req.query.source_id !== 'all') {
        const effectiveSourceId = parseInt(req.query.source_id as string)
        const phoneModelsData = await prisma.account.findMany({
          where: {
            phoneModel: { not: null },
            isSold: false,
            sourceId: effectiveSourceId,
          },
          select: { phoneModel: true },
          distinct: ['phoneModel'],
        })
        phoneModels = phoneModelsData
          .map((m) => m.phoneModel)
          .filter((m): m is string => m !== null)
      } else {
        const phoneModelsData = await prisma.account.findMany({
          where: { phoneModel: { not: null }, isSold: false },
          select: { phoneModel: true, sourceId: true },
          distinct: ['phoneModel'],
        })
        const sourcesOrdered = sources.map((s) => s.id)
        const groupedBySource: Record<number, string[]> = {}
        phoneModelsData.forEach((m) => {
          if (m.sourceId && m.phoneModel) {
            if (!groupedBySource[m.sourceId]) {
              groupedBySource[m.sourceId] = []
            }
            groupedBySource[m.sourceId].push(m.phoneModel)
          }
        })
        const addedModels = new Set<string>()
        for (const sourceId of sourcesOrdered) {
          if (groupedBySource[sourceId]) {
            groupedBySource[sourceId].forEach((model) => {
              if (!addedModels.has(model)) {
                phoneModels.push(model)
                addedModels.add(model)
              }
            })
          }
        }
      }

      // Get target followers
      const targetFollowersData = await prisma.account.findMany({
        where: {
          targetFollowers: { not: null },
          isSold: false,
          ...(req.query.source_id && req.query.source_id !== 'all'
            ? { sourceId: parseInt(req.query.source_id as string) }
            : { sourceId: { in: nonAccsmarketSourceIds } }),
        },
        select: { targetFollowers: true },
        distinct: ['targetFollowers'],
      })
      const targetFollowers = targetFollowersData
        .map((t) => t.targetFollowers)
        .filter((t): t is number => t !== null)
        .sort((a, b) => a - b)

      // Get stats — same source scoping as main query
      const statsWhere: Prisma.AccountWhereInput = { isSold: false }
      if (req.query.source_id && req.query.source_id !== 'all') {
        statsWhere.sourceId = parseInt(req.query.source_id as string)
      } else {
        statsWhere.sourceId = { in: nonAccsmarketSourceIds }
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
      if (req.query.phone_model && req.query.phone_model !== 'all') {
        statsWhere.phoneModel = req.query.phone_model as string
      }

      const [totalAccounts, totalFollowersSum, totalTargetFollowersSum, completedAccounts] = await Promise.all([
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
      ])

      const pagination = {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      }

      res.json({
        accounts,
        sources,
        phoneModels,
        targetFollowers,
        pagination,
        stats: {
          total_accounts: totalAccounts,
          total_followers: totalFollowersSum._sum.currentFollowers ?? 0,
          target_followers: totalTargetFollowersSum._sum.targetFollowers ?? 0,
          completed_accounts: completedAccounts,
        },
      })
    } catch (error) {
      logger.error('Error in AccountsController.index:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get accounts' })
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
          password: password || null,
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
        account,
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
          password: password !== undefined ? password : undefined,
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
        account,
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
