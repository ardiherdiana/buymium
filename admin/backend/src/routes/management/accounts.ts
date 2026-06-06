import express, { Request, Response } from 'express'
import db from '../../config/database'
import { AccountsController } from '../../controllers/management/accounts'
import { AccountsService } from '../../services/management/accountsService'
import { logger } from '../../utils/logger'
import { validate } from '../../middleware/validate'
import { CreateAccountSchema, UpdateAccountSchema, SyncAccountSchema } from '../../validators/management'

const prisma = db

const router = express.Router()

const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  next()
}

router.use(requireAuth)

// Special routes (must be before dynamic :id routes)
router.get('/', AccountsController.index)
router.get('/index', AccountsController.index)
router.get('/sales-mobile', AccountsController.salesMobile)
router.get('/scan/list', async (req: Request, res: Response) => {
  try {
    const sourceId = req.query.source_id as string
    const result = await AccountsService.getAccountsForScan(sourceId)
    res.json(result)
  } catch (error) {
    logger.error('Error getting accounts for scan:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get accounts' })
  }
})

router.get('/search/customers', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string
    const result = await AccountsService.searchCustomers(search || '', undefined, undefined)
    res.json(result)
  } catch (error) {
    logger.error('Error searching customers:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to search customers' })
  }
})

router.post('/sync', validate(SyncAccountSchema), async (req: Request, res: Response) => {
  try {
    const { source_id } = req.body

    if (source_id) {
      const result = await AccountsService.sync(source_id)
      res.json({
        success: true,
        message: `Successfully synced ${result.syncedCount} accounts from ${result.totalSheets} sheet(s).`,
        syncedCount: result.syncedCount,
        totalSheets: result.totalSheets,
      })
    } else {
      // Sync all non-accsmarket sources if source_id is not provided
      const sources = await prisma.source.findMany({
        where: { isAccsmarket: false },
        orderBy: [{ index: 'asc' }, { id: 'asc' }],
      })

      if (!sources.length) {
        return res.status(400).json({ success: false, error: 'No sources found' })
      }

      let totalSyncedCount = 0
      let totalSheets = 0
      const results = []

      for (const source of sources) {
        try {
          const result = await AccountsService.sync(source.id.toString())
          totalSyncedCount += result.syncedCount
          totalSheets += result.totalSheets
          results.push({ source: source.name, ...result })
        } catch (error) {
          logger.error(`Error syncing source '${source.name}':`, error)
          results.push({ source: source.name, error: error instanceof Error ? error.message : 'Failed to sync' })
        }
      }

      res.json({
        success: true,
        message: `Successfully synced ${totalSyncedCount} accounts from ${totalSheets} sheet(s) across ${sources.length} source(s).`,
        syncedCount: totalSyncedCount,
        totalSheets,
        totalSources: sources.length,
        results,
      })
    }
  } catch (error) {
    logger.error('Error syncing accounts:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to sync accounts' })
  }
})

// Dynamic routes (with :id)
router.post('/', validate(CreateAccountSchema), AccountsController.store)
router.put('/:id', validate(UpdateAccountSchema), AccountsController.update)
router.delete('/:id', AccountsController.destroy)

router.post('/:id/refresh-followers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await AccountsService.refreshFollowers(parseInt(id))

    res.json({
      success: true,
      message: `Successfully updated followers count to ${result.follower_count}.`,
      follower_count: result.follower_count,
    })
  } catch (error) {
    logger.error('Error refreshing followers:', error)
    const errorMsg = error instanceof Error ? error.message : 'Failed to refresh followers'
    const status = (error as { response?: { status?: number } })?.response?.status === 429 ? 429 : 500
    res.status(status).json({ success: false, error: errorMsg })
  }
})

export default router
