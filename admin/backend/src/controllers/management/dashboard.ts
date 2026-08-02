import { Request, Response } from 'express'
import { logger } from '../../utils/logger'
import db from '../../config/database'

const prisma = db

export const DashboardController = {
  async index(req: Request, res: Response) {
    try {
      // `year` (Tahun Dibuat) is only ever populated for what used to be
      // "Accsmarket"-type sheets (2FA/Hotmail) — accounts-type sheets
      // (Buymium/Konten) never populate it, so it still cleanly separates the
      // two stock views below now that both live in the same `accounts` table.
      const [
        totalUsers,
        completedAccounts,
        completedAccsmarkets,
        activeAccountsCount,
        activeAccsmarketsCount,
        totalCustomers,
        salesAgg,
        sources,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.account.count({ where: { accountStatus: { in: ['Completed', 'completed'] }, isSold: false, year: null } }),
        prisma.account.count({ where: { accountStatus: { in: ['Completed', 'completed'] }, isSold: false, year: { not: null } } }),
        prisma.account.count({ where: { isSold: false, year: null } }),
        prisma.account.count({ where: { isSold: false, year: { not: null } } }),
        prisma.customer.count(),
        prisma.sale.aggregate({ _sum: { totalSalePrice: true, totalProfit: true } }),
        prisma.source.findMany({ orderBy: { id: 'asc' } }),
      ])

      const sourceNameById = new Map(sources.map((s) => [s.id, s.name]))

      const totalAccounts = completedAccounts + completedAccsmarkets
      const activeAccounts = activeAccountsCount + activeAccsmarketsCount

      // ── Accounts: grouped by Source ──────────────────────────────────────────
      const [stockAcc, accDistRaw] = await Promise.all([
        prisma.account.groupBy({
          by: ['sourceId'],
          where: { accountStatus: { in: ['Completed', 'completed'] }, isSold: false, year: null },
          _count: true,
        }),
        prisma.account.groupBy({
          by: ['sourceId', 'targetFollowers'],
          where: { accountStatus: { in: ['Completed', 'completed'] }, isSold: false, year: null },
          _count: true,
        }),
      ])

      // Build distribution map: sourceId → targetFollowers → count
      const distMap = new Map<number, Map<string, number>>()
      accDistRaw.forEach((row) => {
        const srcId = row.sourceId ?? -1
        const key = String(row.targetFollowers || 0)
        if (!distMap.has(srcId)) distMap.set(srcId, new Map())
        distMap.get(srcId)!.set(key, row._count)
      })

      const accountsStock: { id: number | string; name: string; image: string | null; total_stock: number; distribution: { range: string; count: number }[] }[] = []
      let totalAccountsStock = 0

      for (const row of stockAcc) {
        const accountsCount = row._count
        totalAccountsStock += accountsCount
        const srcId = row.sourceId ?? -1
        const name = sourceNameById.get(srcId) ?? 'Unknown'

        const innerDist = distMap.get(srcId) ?? new Map()
        const formattedAccDistribution = Array.from(innerDist.entries())
          .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
          .map(([key, count]) => ({ range: formatFollowerRange(key), count }))

        accountsStock.push({
          id: row.sourceId ?? 'unknown',
          name,
          image: null,
          total_stock: accountsCount,
          distribution: formattedAccDistribution,
        })
      }

      const stockBySourceAccData = stockAcc
        .map((item) => {
          const name = sourceNameById.get(item.sourceId ?? -1) ?? 'Unknown'
          const percentage = totalAccountsStock > 0 ? (item._count / totalAccountsStock) * 100 : 0
          return {
            name,
            value: item._count,
            percentage: Math.round(percentage * 100) / 100,
            source_id: item.sourceId,
          }
        })
        .sort((a, b) => b.value - a.value)

      // ── Accsmarket-style rows: grouped by Source → year ─────────────────────
      const accsmarketsRaw = await prisma.account.findMany({
        where: {
          accountStatus: { in: ['Completed', 'completed'] },
          isSold: false,
          year: { not: null },
        },
        select: { year: true, targetFollowers: true, sourceId: true },
      })

      const totalAccsmarketStock = accsmarketsRaw.length

      // Group by (sourceId, yearKey) → follower counts
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
        const name = sourceNameById.get(srcId) ?? 'Unknown'
        const dist: { [k: string]: number } = {}
        followers.forEach((f) => { const k = String(f); dist[k] = (dist[k] || 0) + 1 })
        const distribution = Object.keys(dist)
          .sort((a, b) => parseFloat(a) - parseFloat(b))
          .map((k) => ({ range: formatFollowerRange(k), count: dist[k] }))

        accsmarketStock.push({
          id: `${srcId}-${yearKey}`,
          name,
          subtitle: yearKey,
          image: null,
          total_stock: followers.length,
          distribution,
        })
      })

      // Sort: by source name, then 2014-2024 first, then year asc
      accsmarketStock.sort((a, b) => {
        const srcDiff = a.name.localeCompare(b.name)
        if (srcDiff !== 0) return srcDiff
        if (a.subtitle === '2014 - 2024') return -1
        if (b.subtitle === '2014 - 2024') return 1
        return parseInt(a.subtitle) - parseInt(b.subtitle)
      })

      // Distribution pie chart for accsmarket-style rows
      const accsmarketDistRaw = await prisma.account.groupBy({
        by: ['sourceId'],
        where: { accountStatus: { in: ['Completed', 'completed'] }, isSold: false, year: { not: null } },
        _count: true,
      })
      const accsmarketTotal = accsmarketDistRaw.reduce((s, r) => s + r._count, 0)
      const stockBySourceMarketData = accsmarketDistRaw
        .map((item) => {
          const name = sourceNameById.get(item.sourceId ?? -1) ?? 'Unknown'
          return {
            name,
            value: item._count,
            percentage: accsmarketTotal > 0 ? Math.round((item._count / accsmarketTotal) * 10000) / 100 : 0,
            source_id: item.sourceId,
          }
        })
        .sort((a, b) => b.value - a.value)

      const reqUser = req.user
      const userWithRole = reqUser ? await prisma.user.findUnique({
        where: { id: reqUser.userId },
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
        sources,
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
