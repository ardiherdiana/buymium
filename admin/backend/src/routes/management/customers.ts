import express, { Request, Response, NextFunction } from 'express'
import { CustomersController } from '../../controllers/management/customers'
import { validate } from '../../middleware/validate'
import { CreateCustomerSchema, UpdateCustomerSchema } from '../../validators/management'

const router = express.Router()

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  next()
}

router.use(requireAuth)

router.get('/', CustomersController.index)
router.get('/:id', CustomersController.show)
router.post('/', validate(CreateCustomerSchema), CustomersController.store)
router.put('/:id', validate(UpdateCustomerSchema), CustomersController.update)
router.delete('/:id', CustomersController.destroy)

export default router
