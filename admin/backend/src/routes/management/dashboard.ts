import express, { Request, Response, NextFunction } from 'express'
import { DashboardController } from '../../controllers/management/dashboard'

const router = express.Router()

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.use(requireAuth)
router.get('/', DashboardController.index)

export default router
