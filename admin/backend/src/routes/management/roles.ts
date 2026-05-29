import express, { Request, Response, NextFunction } from 'express'
import { RolesController } from '../../controllers/management/roles'

const router = express.Router()
const requireAuth = (req: Request, res: Response, next: NextFunction) => (req.user ? next() : res.status(401).json({ error: 'Unauthorized' }))

router.use(requireAuth)
router.get('/', RolesController.index)
router.post('/', RolesController.store)
router.put('/:id', RolesController.update)
router.delete('/:id', RolesController.destroy)

export default router
