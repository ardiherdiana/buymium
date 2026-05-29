import express, { Request, Response, NextFunction } from 'express'
import { AnalyticsController } from '../../controllers/management/analytics'

const router = express.Router()

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.use(requireAuth)
router.get('/', AnalyticsController.index)

export default router
