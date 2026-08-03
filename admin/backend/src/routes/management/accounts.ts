import express, { Request, Response } from 'express'
import db from '../../config/database'
import { AccountsController } from '../../controllers/management/accounts'
import { AccountsService } from '../../services/management/accountsService'
import { logger } from '../../utils/logger'
import { validate } from '../../middleware/validate'
import { CreateAccountSchema, UpdateAccountSchema } from '../../validators/management'

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
router.get('/phone-models', AccountsController.phoneModels)
router.get('/sales-mobile', AccountsController.salesMobile)
router.get('/export/completed', AccountsController.exportCompleted)
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
    const result = await AccountsService.searchCustomers(search || '')
    res.json(result)
  } catch (error) {
    logger.error('Error searching customers:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to search customers' })
  }
})

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const sourceId = req.body?.source_id ? parseInt(req.body.source_id) : undefined

    if (sourceId) {
      const source = await prisma.source.findUnique({ where: { id: sourceId } })
      if (!source) {
        res.status(404).json({ success: false, error: 'Source not found' })
        return
      }
      const result = await AccountsService.syncSource(source)
      res.json({
        success: true,
        message: `Successfully synced ${result.syncedCount} account(s) from ${result.totalSheets} sheet(s) in source '${source.name}'.`,
        ...result,
      })
      return
    }

    const result = await AccountsService.syncAll()
    res.json({
      success: true,
      message: `Successfully synced ${result.syncedCount} account(s) from ${result.totalSheets} sheet(s) across ${result.totalSources} source(s).`,
      ...result,
    })
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
