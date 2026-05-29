import express, { Request, Response, NextFunction } from 'express'
import { ProblemsController } from '../../controllers/management/problems'

const router = express.Router()
const requireAuth = (req: Request, res: Response, next: NextFunction) => (req.user ? next() : res.status(401).json({ error: 'Unauthorized' }))

router.use(requireAuth)
router.get('/', ProblemsController.index)
router.get('/:id', ProblemsController.show)
router.post('/', ProblemsController.store)
router.put('/:id', ProblemsController.update)
router.delete('/:id', ProblemsController.destroy)

export default router
