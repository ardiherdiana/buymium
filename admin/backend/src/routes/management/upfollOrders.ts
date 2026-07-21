import express, { Request, Response, NextFunction } from 'express'
import { UpfollOrdersController } from '../../controllers/management/upfollOrders'
import { UpfollService } from '../../services/management/upfollService'
import { validate } from '../../middleware/validate'
import { CreateUpfollOrderSchema } from '../../validators/management'
import { logger } from '../../utils/logger'

const router = express.Router()
const requireAuth = (req: Request, res: Response, next: NextFunction) => (req.user ? next() : res.status(401).json({ success: false, error: 'Unauthorized' }))

router.use(requireAuth)

router.get('/', UpfollOrdersController.index)
router.get('/scan/list', async (req: Request, res: Response) => {
  try {
    const result = await UpfollService.getItemsForScan()
    res.json(result)
  } catch (error) {
    logger.error('Gagal mengambil daftar item upfoll untuk scan:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal mengambil daftar item upfoll' })
  }
})
router.get('/:id', UpfollOrdersController.show)
router.post('/', validate(CreateUpfollOrderSchema), UpfollOrdersController.store)
router.delete('/:id', UpfollOrdersController.destroy)

router.post('/items/:id/refresh-followers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await UpfollService.refreshFollowers(parseInt(id))
    res.json({
      success: true,
      message: `Jumlah followers berhasil diperbarui menjadi ${result.follower_count}.`,
      follower_count: result.follower_count,
      status: result.status,
    })
  } catch (error) {
    logger.error('Gagal refresh followers upfoll:', error)
    const errorMsg = error instanceof Error ? error.message : 'Gagal refresh followers'
    const status = (error as { response?: { status?: number } })?.response?.status === 429 ? 429 : 500
    res.status(status).json({ success: false, error: errorMsg })
  }
})

export default router
