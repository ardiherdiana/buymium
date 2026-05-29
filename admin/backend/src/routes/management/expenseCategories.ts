import express, { Request, Response, NextFunction } from 'express'
import { ExpenseCategoriesController } from '../../controllers/management/expenseCategories'
import { validate } from '../../middleware/validate'
import { CreateExpenseCategorySchema, UpdateExpenseCategorySchema } from '../../validators/management'

const router = express.Router()

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.use(requireAuth)

router.get('/', ExpenseCategoriesController.index)
router.post('/', validate(CreateExpenseCategorySchema), ExpenseCategoriesController.store)
router.put('/:id', validate(UpdateExpenseCategorySchema), ExpenseCategoriesController.update)
router.delete('/:id', ExpenseCategoriesController.destroy)

export default router
