import express, { Request, Response, NextFunction } from 'express'
import { SalesController } from '../../controllers/management/sales'
import { validate } from '../../middleware/validate'
import { CreateSaleSchema, UpdateSaleSchema } from '../../validators/management'

const router = express.Router()
const requireAuth = (req: Request, res: Response, next: NextFunction) => (req.user ? next() : res.status(401).json({ success: false, error: 'Unauthorized' }))

router.use(requireAuth)
router.get('/', SalesController.index)
router.get('/:id', SalesController.show)
router.post('/', validate(CreateSaleSchema), SalesController.store)
router.put('/:id', validate(UpdateSaleSchema), SalesController.update)
router.delete('/:id', SalesController.destroy)

export default router
