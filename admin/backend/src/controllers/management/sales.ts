import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { logger } from '../../utils/logger'
import { updateGoogleSheetsAfterSale } from '../../services/management/googleSheets/updateAfterSale'
import db from '../../config/database'

const prisma = db

export const SalesController = {
  async index(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 15
      const searchQuery = req.query.search as string
      const sourceFilter = req.query.source as string
      const dateFromQuery = req.query.date_from as string
      const dateToQuery = req.query.date_to as string

      // Date range bounds in Asia/Jakarta (UTC+7)
      const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000
      const nowUtc = new Date()
      const jakartaNow = new Date(nowUtc.getTime() + JAKARTA_OFFSET_MS)
      const jakartaYear = jakartaNow.getUTCFullYear()
      const jakartaMonth = jakartaNow.getUTCMonth()
      const jakartaDay = jakartaNow.getUTCDate()

      // Parse "YYYY-MM-DD" as a Jakarta local date, converted to its UTC instant
      const parseJakartaDate = (dateStr: string, endOfDay: boolean): Date => {
        const [y, m, d] = dateStr.split('-').map(Number)
        return endOfDay
          ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - JAKARTA_OFFSET_MS)
          : new Date(Date.UTC(y, m - 1, d) - JAKARTA_OFFSET_MS)
      }

      const rangeStart = dateFromQuery
        ? parseJakartaDate(dateFromQuery, false)
        : new Date(Date.UTC(jakartaYear, jakartaMonth, 1) - JAKARTA_OFFSET_MS)
      const rangeEnd = dateToQuery
        ? parseJakartaDate(dateToQuery, true)
        : new Date(Date.UTC(jakartaYear, jakartaMonth, jakartaDay, 23, 59, 59, 999) - JAKARTA_OFFSET_MS)

      // Base where: selected date range + optional source
      const buildWhere = (extra: Prisma.SaleWhereInput = {}): Prisma.SaleWhereInput => {
        const w: Prisma.SaleWhereInput = { createdAt: { gte: rangeStart, lte: rangeEnd }, ...extra }
        if (sourceFilter) w.sourceId = parseInt(sourceFilter)
        return w
      }

      // --- Stats (current month, source-filtered) ---
      const statsWhere = buildWhere()
      const totalSales = await prisma.sale.count({ where: statsWhere })
      const aggregates = await prisma.sale.aggregate({
        where: statsWhere,
        _sum: { totalSalePrice: true, totalProfit: true },
      })
      const totalSalePrice = aggregates._sum.totalSalePrice || 0
      const totalProfit = aggregates._sum.totalProfit || 0
      const totalCapital = totalSalePrice - totalProfit

      // --- Chart data (all sales within the selected range, source-filtered) ---
      const rangeSales = await prisma.sale.findMany({
        where: buildWhere(),
        select: {
          createdAt: true,
          totalSalePrice: true,
          totalProfit: true,
          _count: { select: { saleLines: true } },
          saleLines: { select: { unitSalePrice: true, profit: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

      type DayEntry = { label: string; sales: number; amount: number; profit: number }
      const byDate = new Map<string, DayEntry>()

      // Walk the selected range day-by-day in Jakarta local time
      const jakartaRangeStart = new Date(rangeStart.getTime() + JAKARTA_OFFSET_MS)
      const jakartaRangeEnd = new Date(rangeEnd.getTime() + JAKARTA_OFFSET_MS)
      const cursor = new Date(Date.UTC(
        jakartaRangeStart.getUTCFullYear(), jakartaRangeStart.getUTCMonth(), jakartaRangeStart.getUTCDate()
      ))
      const lastDay = new Date(Date.UTC(
        jakartaRangeEnd.getUTCFullYear(), jakartaRangeEnd.getUTCMonth(), jakartaRangeEnd.getUTCDate()
      ))
      while (cursor <= lastDay) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`
        byDate.set(key, { label: String(cursor.getUTCDate()), sales: 0, amount: 0, profit: 0 })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }

      for (const sale of rangeSales) {
        const jDate = new Date(sale.createdAt.getTime() + JAKARTA_OFFSET_MS)
        const key = `${jDate.getUTCFullYear()}-${String(jDate.getUTCMonth() + 1).padStart(2, '0')}-${String(jDate.getUTCDate()).padStart(2, '0')}`
        const entry = byDate.get(key)
        if (!entry) continue
        entry.sales += sale._count.saleLines || 1
        const lineHargaJual = sale.saleLines.reduce((s, l) => s + (l.unitSalePrice || 0), 0)
        const lineProfit = sale.saleLines.reduce((s, l) => s + l.profit, 0)
        entry.amount += lineHargaJual || sale.totalSalePrice
        entry.profit += lineProfit || sale.totalProfit
      }

      const chartData = Array.from(byDate.entries()).map(([date, e]) => ({
        date,
        label: e.label,
        sales: e.sales,
        amount: e.amount,
        profit: e.profit,
      }))

      // --- Paginated sales list ---
      const listWhere: Prisma.SaleWhereInput = buildWhere()
      if (searchQuery) {
        listWhere.OR = [
          { salesNumber: { contains: searchQuery } },
          { customer: { usernameSh: { contains: searchQuery } } },
        ]
        if (sourceFilter) {
          // OR must not break the source filter — re-apply as AND
          listWhere.AND = [
            { sourceId: parseInt(sourceFilter) },
            { OR: listWhere.OR },
          ]
          delete listWhere.OR
        }
      }

      const sales = await prisma.sale.findMany({
        where: listWhere,
        include: {
          customer: true,
          source: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })

      const total = await prisma.sale.count({ where: listWhere })

      const salesWithMapping = sales.map(sale => ({
        id: sale.id,
        salesNumber: sale.salesNumber,
        customerId: sale.customerId,
        totalSalePrice: sale.totalSalePrice,
        totalProfit: sale.totalProfit,
        isShopee: sale.isShopee,
        sourceId: sale.sourceId,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
        customer: sale.customer ? {
          id: sale.customer.id,
          usernameSh: sale.customer.usernameSh,
        } : undefined,
        source: sale.source ? {
          id: sale.source.id,
          name: sale.source.name,
        } : undefined,
      }))

      res.json({
        sales: salesWithMapping,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        stats: {
          totalSales,
          totalCapital,
          totalSalePrice,
          totalProfit,
        },
        chartData,
      })
    } catch (error) {
      logger.error('Error fetching sales:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch sales' })
    }
  },

  async show(req: Request, res: Response) {
    try {
      const { id } = req.params

      const sale = await prisma.sale.findUnique({
        where: { id: parseInt(id) },
        include: {
          customer: true,
          source: true,
          saleLines: {
            include: {
              account: true,
              accsmarket: true,
            },
          },
        },
      })

      if (!sale) {
        return res.status(404).json({ error: 'Sale not found' })
      }

      const saleWithMapping = {
        id: sale.id,
        sales_number: sale.salesNumber,
        customer_id: sale.customerId,
        total_sale_price: sale.totalSalePrice,
        total_profit: sale.totalProfit,
        is_shopee: sale.isShopee,
        source_id: sale.sourceId,
        status: 'completed',
        created_at: sale.createdAt,
        updated_at: sale.updatedAt,
        customer: sale.customer ? {
          id: sale.customer.id,
          usernameSh: sale.customer.usernameSh,
          nomorHp: sale.customer.nomorHp,
        } : undefined,
        source: sale.source ? {
          id: sale.source.id,
          name: sale.source.name,
        } : undefined,
        sale_lines: sale.saleLines?.map(line => {
          const item = line.account ?? line.accsmarket
          return {
            id: line.id,
            sale_id: line.saleId,
            account_id: line.accountId,
            accsmarket_id: line.accsmarketId,
            unit_sale_price: line.unitSalePrice,
            profit: line.profit,
            created_at: line.createdAt,
            account: item ? {
              id: item.id,
              username: item.username,
              email: item.email,
              targetFollowers: item.targetFollowers,
            } : undefined,
          }
        }) || [],
      }

      res.json({ sale: saleWithMapping })
    } catch (error) {
      logger.error('Error fetching sale detail:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch sale' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { sales_number, customer_id, total_sale_price, total_profit, is_shopee, source_id, items } = req.body

      if (!sales_number || !customer_id || !total_sale_price || !total_profit) {
        return res.status(400).json({ error: 'Required fields missing' })
      }

      // Extract account and accsmarket IDs first (before creating sale)
      const accountIds: number[] = []
      const accsmarketIds: number[] = []

      if (items && Array.isArray(items)) {
        for (const item of items) {
          if (item.account_id) {
            accountIds.push(parseInt(item.account_id))
          }
          if (item.accsmarket_id) {
            accsmarketIds.push(parseInt(item.accsmarket_id))
          }
        }
      }

      // Fetch accounts and accsmarkets to get sourceId if not provided
      let sourceIdForSale = source_id ? parseInt(source_id) : null
      let itemsToUpdateSheets: { id: number; email?: string | null; username?: string | null; phoneModel?: string | null; year?: string | null; sourceId?: number | null; source?: { id: number; spreadsheetId?: string | null } | null; isSold?: boolean }[] = []

      if (accountIds.length > 0 || accsmarketIds.length > 0) {
        const accountsToUpdate = accountIds.length > 0
          ? await prisma.account.findMany({
              where: { id: { in: accountIds } },
              include: { source: true },
            })
          : []

        const accsmarketsToUpdate = accsmarketIds.length > 0
          ? await prisma.accsmarket.findMany({
              where: { id: { in: accsmarketIds } },
              include: { source: true },
            })
          : []

        itemsToUpdateSheets = [...accountsToUpdate, ...accsmarketsToUpdate]

        // If source_id not provided, use from first account/accsmarket
        if (!sourceIdForSale && itemsToUpdateSheets.length > 0) {
          sourceIdForSale = itemsToUpdateSheets[0].sourceId ?? null
        }
      }

      logger.info(`[Sale] Received ${items?.length || 0} items to process`)
      logger.info(`[Sale] Collecting items - accountIds: ${accountIds.join(',')}, accsmarketIds: ${accsmarketIds.join(',')}`)

      const sale = await prisma.sale.create({
        data: {
          salesNumber: sales_number,
          customerId: parseInt(customer_id),
          totalSalePrice: parseFloat(total_sale_price),
          totalProfit: parseFloat(total_profit),
          isShopee: is_shopee || false,
          sourceId: sourceIdForSale,
        },
        include: { customer: true, source: true },
      })

      // Log collected items
      if (itemsToUpdateSheets.length > 0) {
        logger.info(`[Sale] Collected items for update:`, {
          total: itemsToUpdateSheets.length,
          details: itemsToUpdateSheets.map((i) => ({
            id: i.id,
            email: i.email,
            username: i.username,
            type: 'year' in i ? 'Accsmarket' : 'Account',
            sheetName: ('year' in i) ? i.year : i.phoneModel,
            sourceId: i.sourceId,
          })),
        })
      }

      // Create sale lines and mark accounts/accsmarkets as sold — all in one transaction
      if (items && Array.isArray(items) && items.length > 0) {
        const lineOps = items.flatMap((item: { account_id?: string | number; accsmarket_id?: string | number; unit_sale_price?: string | number; profit?: string | number }) => {
          const accountId = item.account_id ? parseInt(String(item.account_id)) : null
          const accsmarketId = item.accsmarket_id ? parseInt(String(item.accsmarket_id)) : null

          logger.debug(`[Sale] Processing item - accountId: ${accountId}, accsmarketId: ${accsmarketId}`)

          const ops: Prisma.PrismaPromise<unknown>[] = [
            prisma.saleLine.create({
              data: {
                saleId: sale.id,
                accountId,
                accsmarketId,
                unitSalePrice: parseFloat(String(item.unit_sale_price ?? 0)) || 0,
                price: parseFloat(String(item.unit_sale_price ?? 0)) || 0,
                profit: parseFloat(String(item.profit ?? 0)) || 0,
              },
            }),
          ]

          if (accountId) {
            ops.push(prisma.account.update({ where: { id: accountId }, data: { isSold: true } }))
          } else if (accsmarketId) {
            ops.push(prisma.accsmarket.update({ where: { id: accsmarketId }, data: { isSold: true } }))
          }

          return ops
        })

        await prisma.$transaction(lineOps)
      }

      const saleWithLines = await prisma.sale.findUnique({
        where: { id: sale.id },
        include: {
          customer: true,
          source: true,
          saleLines: {
            include: {
              account: true,
              accsmarket: true,
            },
          },
        },
      })

      const saleWithMapping = {
        id: saleWithLines?.id,
        sales_number: saleWithLines?.salesNumber,
        customer_id: saleWithLines?.customerId,
        total_sale_price: saleWithLines?.totalSalePrice,
        total_profit: saleWithLines?.totalProfit,
        is_shopee: saleWithLines?.isShopee,
        source_id: saleWithLines?.sourceId,
        status: 'completed',
        created_at: saleWithLines?.createdAt,
        updated_at: saleWithLines?.updatedAt,
        customer: saleWithLines?.customer ? {
          id: saleWithLines.customer.id,
          username_shopee: saleWithLines.customer.usernameSh,
        } : undefined,
        source: saleWithLines?.source ? {
          id: saleWithLines.source.id,
          name: saleWithLines.source.name,
        } : undefined,
        saleLines: saleWithLines?.saleLines?.map(line => ({
          id: line.id,
          sale_id: line.saleId,
          account_id: line.accountId,
          accsmarket_id: line.accsmarketId,
          unit_sale_price: line.unitSalePrice,
          price: line.price,
          profit: line.profit,
          created_at: line.createdAt,
          account: line.account ? {
            id: line.account.id,
            username: line.account.username,
            email: line.account.email,
          } : undefined,
          accsmarket: line.accsmarket ? {
            id: line.accsmarket.id,
            username: line.accsmarket.username,
            email: line.accsmarket.email,
          } : undefined,
        })) || [],
      }

      res.status(201).json({ success: true, sale: saleWithMapping })

      // Update Google Sheets asynchronously (don't wait for it)
      if (itemsToUpdateSheets.length > 0) {
        logger.info(`[Sale] Triggering Google Sheets update for ${itemsToUpdateSheets.length} items`, {
          items: itemsToUpdateSheets.map((i) => ({
            id: i.id,
            type: 'year' in i ? 'Accsmarket' : 'Account',
            sheetName: 'year' in i ? i.year : i.phoneModel,
            spreadsheetId: 'year' in i
              ? '1riOQRkG-76-SdlvVw_cxK2igSoTpgcqtBWz_RLztxdg'
              : i.source?.spreadsheetId,
          })),
        })

        updateGoogleSheetsAfterSale(itemsToUpdateSheets).catch(err =>
          logger.error('Background Google Sheets update failed:', err)
        )
      } else {
        logger.warn('[Sale] No items collected for Google Sheets update')
      }
    } catch (error) {
      logger.error('Error creating sale:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create sale' })
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params

      await prisma.sale.delete({
        where: { id: parseInt(id) },
      })

      res.json({ success: true, message: 'Sale deleted successfully' })
    } catch (error) {
      logger.error('Error deleting sale:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete sale' })
    }
  },
}
