import express, { Request, Response, NextFunction } from 'express'
import { UsersController } from '../../controllers/management/users'

const router = express.Router()
const requireAuth = (req: Request, res: Response, next: NextFunction) => (req.user ? next() : res.status(401).json({ error: 'Unauthorized' }))

router.use(requireAuth)
router.get('/', UsersController.index)
router.post('/', UsersController.store)
router.put('/:id', UsersController.update)
router.delete('/:id', UsersController.destroy)

export default router
