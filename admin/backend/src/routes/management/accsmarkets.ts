import express, { Request, Response } from 'express'
import { AccsmarketsController } from '../../controllers/management/accsmarkets'
import { AccsmarketsService } from '../../services/management/accsmarketsService'
import { logger } from '../../utils/logger'
import { validate } from '../../middleware/validate'
import { CreateAccsmarketSchema, UpdateAccsmarketSchema } from '../../validators/management'

const router = express.Router()

const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.use(requireAuth)

router.get('/index', AccsmarketsController.index)
router.get('/history', AccsmarketsController.history)
router.get('/sales-mobile', AccsmarketsController.salesMobile)
router.get('/scan/list', async (req: Request, res: Response) => {
  try {
    const sourceIdRaw = req.query.source_id as string | undefined
    const sourceId = sourceIdRaw && sourceIdRaw !== 'all' ? parseInt(sourceIdRaw) : undefined
    const result = await AccsmarketsService.getAccountsForScan(sourceId)
    res.json(result)
  } catch (error) {
    logger.error('Error getting accounts for scan:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get accounts' })
  }
})

router.get('/search/customers', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string
    const result = await AccsmarketsService.searchCustomers(search || '', undefined, undefined)
    res.json(result)
  } catch (error) {
    logger.error('Error searching customers:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to search customers' })
  }
})

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.body
    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId is required' })
    }
    const result = await AccsmarketsService.sync(parseInt(sourceId))

    res.json({
      success: true,
      message: `Successfully synced ${result.syncedCount} accounts from ${result.totalSheets} sheet(s).`,
      syncedCount: result.syncedCount,
      totalSheets: result.totalSheets,
    })
  } catch (error) {
    logger.error('Error syncing accsmarkets:', error)
    const errorMsg = error instanceof Error ? error.message : 'Failed to sync accounts'
    res.status(500).json({ error: errorMsg })
  }
})

router.post('/', validate(CreateAccsmarketSchema), AccsmarketsController.store)
router.put('/:id', validate(UpdateAccsmarketSchema), AccsmarketsController.update)
router.delete('/:id', AccsmarketsController.destroy)

router.post('/:id/refresh-followers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await AccsmarketsService.refreshFollowers(parseInt(id))

    res.json({
      success: true,
      message: `Successfully updated followers count to ${result.follower_count}. Status: ${result.account_status}`,
      follower_count: result.follower_count,
      account_status: result.account_status,
    })
  } catch (error) {
    logger.error('Error refreshing followers:', error)
    const errorMsg = error instanceof Error ? error.message : 'Failed to refresh followers'
    res.status(500).json({ success: false, error: errorMsg })
  }
})

export default router
