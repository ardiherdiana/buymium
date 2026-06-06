import { Request, Response } from 'express'
import { logger } from '../../utils/logger'
import db from '../../config/database'
import { Prisma } from '@prisma/client'

const prisma = db

export const DashboardController = {
  async index(req: Request, res: Response) {
    try {
      const user = req.user
      const autoFilterSourceId: number | null = null

      const [
        totalUsers,
        completedAccounts,
        completedAccsmarkets,
        activeAccountsCount,
        activeAccsmarketsCount,
        totalCustomers,
        salesAgg,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.account.count({ where: { accountStatus: 'Completed', isSold: false } }),
        prisma.accsmarket.count({ where: { accountStatus: 'completed', isSold: false } }),
        prisma.account.count({ where: { isSold: false } }),
        prisma.accsmarket.count({ where: { isSold: false } }),
        prisma.customer.count(),
        prisma.sale.aggregate({ _sum: { totalSalePrice: true, totalProfit: true } }),
      ])

      const totalAccounts = completedAccounts + completedAccsmarkets
      const activeAccounts = activeAccountsCount + activeAccsmarketsCount

      // ── Accounts: grouped by source ──────────────────────────────────────────
      const sourcesQuery: Prisma.SourceFindManyArgs = {
        orderBy: [{ index: 'asc' }, { id: 'asc' }],
      }

      if (autoFilterSourceId) {
        sourcesQuery.where = { id: autoFilterSourceId }
      }

      const sources = await prisma.source.findMany(sourcesQuery)

      // Use groupBy instead of loading all account rows into memory
      const [stockAcc, accDistRaw] = await Promise.all([
        prisma.account.groupBy({
          by: ['sourceId'],
          where: { accountStatus: 'Completed', isSold: false, ...(autoFilterSourceId ? { sourceId: autoFilterSourceId } : {}) },
          _count: true,
        }),
        prisma.account.groupBy({
          by: ['sourceId', 'targetFollowers'],
          where: { accountStatus: 'Completed', isSold: false, ...(autoFilterSourceId ? { sourceId: autoFilterSourceId } : {}) },
          _count: true,
        }),
      ])

      const sourcesMap = new Map(sources.map((s) => [s.id, s]))

      // Build distribution map: sourceId → targetFollowers → count
      const distMap = new Map<number, Map<string, number>>()
      accDistRaw.forEach((row) => {
        const srcId = row.sourceId ?? -1
        const key = String(row.targetFollowers || 0)
        if (!distMap.has(srcId)) distMap.set(srcId, new Map())
        distMap.get(srcId)!.set(key, row._count)
      })

      let accountsStock: { id: number | null | undefined; name: string; image: string | null; total_stock: number; distribution: { range: string; count: number }[] }[] = []
      let totalAccountsStock = 0

      for (const row of stockAcc) {
        const accountsCount = row._count
        totalAccountsStock += accountsCount
        const source = sourcesMap.get(row.sourceId ?? -1)

        const innerDist = distMap.get(row.sourceId ?? -1) ?? new Map()
        const formattedAccDistribution = Array.from(innerDist.entries())
          .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
          .map(([key, count]) => ({ range: formatFollowerRange(key), count }))

        accountsStock.push({
          id: source?.id ?? row.sourceId,
          name: source?.name ?? 'Unknown',
          image: null,
          total_stock: accountsCount,
          distribution: formattedAccDistribution,
        })
      }

      const stockBySourceAccData = stockAcc
        .filter((item) => !sourcesMap.get(item.sourceId ?? -1)?.isAccsmarket)
        .map((item) => {
          const source = sourcesMap.get(item.sourceId ?? -1)
          const percentage = totalAccountsStock > 0 ? (item._count / totalAccountsStock) * 100 : 0
          return {
            name: source?.name || 'Unknown',
            value: item._count,
            percentage: Math.round(percentage * 100) / 100,
            source_id: item.sourceId,
          }
        })
        .sort((a, b) => b.value - a.value)

      // ── Accsmarket: grouped by source → year ────────────────────────────────
      const accsmarketsRaw = await prisma.accsmarket.findMany({
        where: {
          accountStatus: 'completed',
          isSold: false,
          ...(autoFilterSourceId ? { sourceId: autoFilterSourceId } : {}),
        },
        select: { year: true, targetFollowers: true, sourceId: true },
      })

      const totalAccsmarketStock = accsmarketsRaw.length

      // Group by (sourceId, yearKey) → follower counts
      // Each (source, year) pair becomes one card
      const srcYearFollowersMap = new Map<string, { srcId: number; yearKey: string; followers: number[] }>()
      accsmarketsRaw.forEach((acc) => {
        const srcId = acc.sourceId ?? -1
        const raw = acc.year?.trim() || 'Unknown'
        const num = parseInt(raw, 10)
        const yearKey = !isNaN(num) && num >= 2014 && num <= 2024 ? '2014 - 2024' : raw
        const key = `${srcId}||${yearKey}`
        if (!srcYearFollowersMap.has(key)) srcYearFollowersMap.set(key, { srcId, yearKey, followers: [] })
        srcYearFollowersMap.get(key)!.followers.push(acc.targetFollowers || 0)
      })

      const accsmarketStock: { id: string; name: string; subtitle: string; image: string | null; total_stock: number; distribution: { range: string; count: number }[] }[] = []
      srcYearFollowersMap.forEach(({ srcId, yearKey, followers }) => {
        const source = sourcesMap.get(srcId)
        const dist: { [k: string]: number } = {}
        followers.forEach((f) => { const k = String(f); dist[k] = (dist[k] || 0) + 1 })
        const distribution = Object.keys(dist)
          .sort((a, b) => parseFloat(a) - parseFloat(b))
          .map((k) => ({ range: formatFollowerRange(k), count: dist[k] }))

        accsmarketStock.push({
          id: `${srcId}-${yearKey}`,
          name: source?.name ?? 'Unknown',
          subtitle: yearKey,
          image: null,
          total_stock: followers.length,
          distribution,
        })
      })

      // Sort: by source order (from sources list), then 2014-2024 first, then year asc
      const sourceOrder = sources.map((s) => s.id)
      accsmarketStock.sort((a, b) => {
        const aSrcId = parseInt(a.id.split('-')[0])
        const bSrcId = parseInt(b.id.split('-')[0])
        const srcDiff = sourceOrder.indexOf(aSrcId) - sourceOrder.indexOf(bSrcId)
        if (srcDiff !== 0) return srcDiff
        if (a.subtitle === '2014 - 2024') return -1
        if (b.subtitle === '2014 - 2024') return 1
        return parseInt(a.subtitle) - parseInt(b.subtitle)
      })

      // Distribution pie chart for accsmarket — simple groupBy sourceId from DB
      const accsmarketDistRaw = await prisma.accsmarket.groupBy({
        by: ['sourceId'],
        where: { accountStatus: 'completed', isSold: false },
        _count: true,
      })
      const accsmarketTotal = accsmarketDistRaw.reduce((s, r) => s + r._count, 0)
      const stockBySourceMarketData = accsmarketDistRaw
        .filter((item) => sourcesMap.get(item.sourceId ?? -1)?.isAccsmarket)
        .map((item) => {
          const source = sourcesMap.get(item.sourceId ?? -1)
          return {
            name: source?.name ?? 'Unknown',
            value: item._count,
            percentage: accsmarketTotal > 0 ? Math.round((item._count / accsmarketTotal) * 10000) / 100 : 0,
            source_id: item.sourceId,
          }
        })
        .sort((a, b) => b.value - a.value)

      const userWithRole = user ? await prisma.user.findUnique({
        where: { id: user.userId },
        include: { role: true },
      }) : null

      const roleName = userWithRole?.role?.name || 'User'

      res.json({
        statistics: {
          total_users: totalUsers,
          total_accounts: totalAccounts,
          active_accounts: activeAccounts,
          total_customers: totalCustomers,
          total_revenue: salesAgg._sum.totalSalePrice || 0,
          total_profit: salesAgg._sum.totalProfit || 0,
        },
        accounts_stock: {
          total_stock: totalAccountsStock,
          platforms: accountsStock,
          distribution: stockBySourceAccData,
        },
        accsmarket_stock: {
          total_stock: totalAccsmarketStock,
          platforms: accsmarketStock,
          distribution: stockBySourceMarketData,
        },
        user: {
          name: userWithRole?.name,
          role: roleName,
        },
      })
    } catch (error) {
      logger.error('Error in dashboard index:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
    }
  },
}

function formatFollowerRange(key: string): string {
  if (key === '0') {
    return '0 pengikut'
  }
  const num = parseFloat(key)
  return num.toLocaleString('id-ID') + ' pengikut'
}
