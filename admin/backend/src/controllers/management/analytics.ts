import { Request, Response } from 'express'
import { logger } from '../../utils/logger'
import db from '../../config/database'

const prisma = db

export const AnalyticsController = {
  async index(req: Request, res: Response) {
    try {
      const year = req.query.year ? String(req.query.year) : String(new Date().getFullYear())
      const month = req.query.month ? String(req.query.month) : String(new Date().getMonth() + 1)
      const sourceId = req.query.source_id ? String(req.query.source_id) : 'all'

      // Date ranges
      let startDate: Date
      let endDate: Date
      let prevStartDate: Date | null = null
      let prevEndDate: Date | null = null
      let comparisonLabel = ''

      if (year === 'all') {
        startDate = new Date(2000, 0, 1)
        endDate = new Date()
        endDate.setFullYear(endDate.getFullYear() + 1)
      } else if (month === 'all') {
        startDate = new Date(parseInt(year), 0, 1)
        endDate = new Date(parseInt(year), 11, 31)
        prevStartDate = new Date(parseInt(year) - 1, 0, 1)
        prevEndDate = new Date(parseInt(year) - 1, 11, 31)
        comparisonLabel = `vs ${parseInt(year) - 1}`
      } else {
        startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
        endDate = new Date(parseInt(year), parseInt(month), 0)
        prevStartDate = new Date(parseInt(year), parseInt(month) - 2, 1)
        prevEndDate = new Date(parseInt(year), parseInt(month) - 1, 0)
        const monthName = new Intl.DateTimeFormat('en', { month: 'long' }).format(prevStartDate)
        comparisonLabel = `vs ${monthName}`
      }

      const expenseStartDate = year === 'all' ? new Date(2000, 0, 1) : new Date(parseInt(year), 0, 1)
      const expenseEndDate = year === 'all' ? new Date(new Date().getFullYear() + 1, 0, 0) : new Date(parseInt(year), 11, 31)

      const sourceFilter = sourceId !== 'all' ? parseInt(sourceId) : null

      // Sales Trend
      const salesTrendData = await prisma.sale.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          ...(sourceFilter && { sourceId: sourceFilter }),
        },
        select: {
          createdAt: true,
          totalSalePrice: true,
          totalProfit: true,
        },
      })

      const salesTrendMap = new Map<string, { revenue: number; profit: number }>()

      salesTrendData.forEach((sale) => {
        let key: string
        if (month === 'all') {
          key = String((sale.createdAt.getMonth() + 1).toString().padStart(2, '0'))
        } else {
          key = String(sale.createdAt.getDate().toString().padStart(2, '0'))
        }

        if (!salesTrendMap.has(key)) {
          salesTrendMap.set(key, { revenue: 0, profit: 0 })
        }
        const data = salesTrendMap.get(key)!
        data.revenue += sale.totalSalePrice
        data.profit += sale.totalProfit
      })

      const trendData: { date: string | number; revenue: number; profit: number }[] = []
      if (month === 'all') {
        for (let i = 1; i <= 12; i++) {
          const key = i.toString().padStart(2, '0')
          const data = salesTrendMap.get(key)
          const date = new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(2000, i - 1))
          trendData.push({
            date,
            revenue: data ? data.revenue : 0,
            profit: data ? data.profit : 0,
          })
        }
      } else {
        let current = new Date(startDate)
        while (current <= endDate) {
          const key = current.getDate().toString().padStart(2, '0')
          const data = salesTrendMap.get(key)
          trendData.push({
            date: current.getDate(),
            revenue: data ? data.revenue : 0,
            profit: data ? data.profit : 0,
          })
          current.setDate(current.getDate() + 1)
        }
      }

      // Expense Trend (Always monthly)
      const expensesTrendData = await prisma.expense.findMany({
        where: {
          expenseDate: { gte: expenseStartDate, lte: expenseEndDate },
          ...(sourceFilter && { sourceId: sourceFilter }),
        },
        select: { expenseDate: true, amount: true },
      })

      const expensesTrendMap = new Map<number, number>()
      expensesTrendData.forEach((exp) => {
        const month = exp.expenseDate.getMonth() + 1
        expensesTrendMap.set(month, (expensesTrendMap.get(month) || 0) + exp.amount)
      })

      const expenseTrend: { date: string; value: number }[] = []
      for (let i = 1; i <= 12; i++) {
        const date = new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(2000, i - 1))
        expenseTrend.push({
          date,
          value: expensesTrendMap.get(i) || 0,
        })
      }

      // Sales Count Trend
      const salesCountData = await prisma.saleLine.findMany({
        where: {
          sale: {
            createdAt: { gte: startDate, lte: endDate },
            ...(sourceFilter && { sourceId: sourceFilter }),
          },
        },
        select: { sale: { select: { createdAt: true } } },
      })

      const salesCountMap = new Map<string, number>()
      salesCountData.forEach((item) => {
        let key: string
        if (month === 'all') {
          key = String((item.sale.createdAt.getMonth() + 1).toString().padStart(2, '0'))
        } else {
          key = String(item.sale.createdAt.getDate().toString().padStart(2, '0'))
        }
        salesCountMap.set(key, (salesCountMap.get(key) || 0) + 1)
      })

      const salesCountTrend: { date: string | number; count: number }[] = []
      if (month === 'all') {
        for (let i = 1; i <= 12; i++) {
          const key = i.toString().padStart(2, '0')
          const date = new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(2000, i - 1))
          salesCountTrend.push({
            date,
            count: salesCountMap.get(key) || 0,
          })
        }
      } else {
        let current = new Date(startDate)
        while (current <= endDate) {
          const key = current.getDate().toString().padStart(2, '0')
          salesCountTrend.push({
            date: current.getDate(),
            count: salesCountMap.get(key) || 0,
          })
          current.setDate(current.getDate() + 1)
        }
      }

      // Sales by Platform
      const salesByPlatformData = await prisma.sale.groupBy({
        by: ['isShopee'],
        where: {
          createdAt: { gte: startDate, lte: endDate },
          ...(sourceFilter && { sourceId: sourceFilter }),
        },
        _count: true,
        _sum: { totalSalePrice: true },
      })

      const salesByPlatform = salesByPlatformData.map((item) => ({
        name: item.isShopee ? 'Shopee' : 'Direct',
        value: item._count,
        total: item._sum.totalSalePrice || 0,
      }))

      // Expenses by Category
      const expensesByCategoryData = await prisma.expense.findMany({
        where: {
          expenseDate: { gte: startDate, lte: endDate },
          ...(sourceFilter && { sourceId: sourceFilter }),
        },
        include: { category: true },
      })

      const expensesByCategory = new Map<string, number>()
      expensesByCategoryData.forEach((exp) => {
        const name = exp.category?.name || 'Uncategorized'
        expensesByCategory.set(name, (expensesByCategory.get(name) || 0) + exp.amount)
      })

      const expensesByCategoryArray = Array.from(expensesByCategory).map(([name, value]) => ({
        name,
        value,
      }))

      // Summary Stats
      const filteredSales = await prisma.sale.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          ...(sourceFilter && { sourceId: sourceFilter }),
        },
        _sum: { totalSalePrice: true, totalProfit: true },
      })

      const totalRevenue = filteredSales._sum.totalSalePrice || 0
      const totalProfit = filteredSales._sum.totalProfit || 0
      const totalCapital = totalRevenue - totalProfit

      const totalExpenses = await prisma.expense.aggregate({
        where: {
          expenseDate: { gte: startDate, lte: endDate },
          ...(sourceFilter && { sourceId: sourceFilter }),
        },
        _sum: { amount: true },
      })

      const totalExpensesAmount = totalExpenses._sum.amount || 0
      const netProfit = totalProfit - totalExpensesAmount

      // Profit by Source
      const profitBySourceData = await prisma.sale.groupBy({
        by: ['sourceId'],
        where: {
          createdAt: { gte: startDate, lte: endDate },
          ...(sourceFilter && { sourceId: sourceFilter }),
        },
        _sum: { totalProfit: true },
        orderBy: { _sum: { totalProfit: 'desc' } },
      })

      // Fetch sources once — reused for profitBySource map and for the response
      const allSources = await prisma.source.findMany()
      const sourcesMap = new Map(allSources.map((s) => [s.id, { name: s.name, color: s.color }]))

      const profitBySource = profitBySourceData.map((item) => {
        const source = sourcesMap.get(item.sourceId ?? -1)
        return {
          name: source?.name || 'Unknown',
          value: item._sum.totalProfit || 0,
          color: source?.color,
        }
      })

      type ComparisonEntry = { change: number; label: string }
      type Comparisons = {
        revenue: ComparisonEntry
        profit: ComparisonEntry
        capital: ComparisonEntry
        expenses: ComparisonEntry
        net_profit: ComparisonEntry
        margin: ComparisonEntry
        net_margin: ComparisonEntry
      }
      // Comparisons
      let comparisons: Comparisons = {
        revenue: { change: 0, label: '' },
        profit: { change: 0, label: '' },
        capital: { change: 0, label: '' },
        expenses: { change: 0, label: '' },
        net_profit: { change: 0, label: '' },
        margin: { change: 0, label: '' },
        net_margin: { change: 0, label: '' },
      }

      if (prevStartDate && prevEndDate) {
        const prevSalesAgg = await prisma.sale.aggregate({
          where: {
            createdAt: { gte: prevStartDate, lte: prevEndDate },
            ...(sourceFilter && { sourceId: sourceFilter }),
          },
          _sum: { totalSalePrice: true, totalProfit: true },
        })

        const prevRevenue = prevSalesAgg._sum.totalSalePrice || 0
        const prevProfit = prevSalesAgg._sum.totalProfit || 0
        const prevCapital = prevRevenue - prevProfit

        const prevExpensesAgg = await prisma.expense.aggregate({
          where: {
            expenseDate: { gte: prevStartDate, lte: prevEndDate },
            ...(sourceFilter && { sourceId: sourceFilter }),
          },
          _sum: { amount: true },
        })

        const prevExpenses = prevExpensesAgg._sum.amount || 0
        const prevNetProfit = prevProfit - prevExpenses

        const calculateChange = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0
          return Math.round(((current - previous) / previous) * 1000) / 10
        }

        comparisons = {
          revenue: { change: calculateChange(totalRevenue, prevRevenue), label: comparisonLabel },
          profit: { change: calculateChange(totalProfit, prevProfit), label: comparisonLabel },
          capital: { change: calculateChange(totalCapital, prevCapital), label: comparisonLabel },
          expenses: { change: calculateChange(totalExpensesAmount, prevExpenses), label: comparisonLabel },
          net_profit: { change: calculateChange(netProfit, prevNetProfit), label: comparisonLabel },
          margin: {
            change: calculateChange(
              totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
              prevRevenue > 0 ? (prevProfit / prevRevenue) * 100 : 0
            ),
            label: comparisonLabel,
          },
          net_margin: {
            change: calculateChange(
              totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
              prevRevenue > 0 ? (prevNetProfit / prevRevenue) * 100 : 0
            ),
            label: comparisonLabel,
          },
        }
      }

      const sources = allSources

      res.json({
        trendData,
        expenseTrend,
        salesCountTrend,
        salesByPlatform,
        expensesByCategory: expensesByCategoryArray,
        profitBySource,
        sources,
        filters: {
          year: year === 'all' ? 'all' : parseInt(year),
          month: month === 'all' ? 'all' : parseInt(month),
          source_id: sourceId === 'all' ? 'all' : parseInt(sourceId),
        },
        summary: {
          revenue: totalRevenue,
          profit: totalProfit,
          capital: totalCapital,
          expenses: totalExpensesAmount,
          net_profit: netProfit,
          margin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0,
          net_margin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0,
          comparisons,
        },
      })
    } catch (error) {
      logger.error('Error in analytics index:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' })
    }
  },
}
