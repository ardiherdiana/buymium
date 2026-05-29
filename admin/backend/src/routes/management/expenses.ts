import express, { Request, Response, NextFunction } from 'express'
import { ExpensesController } from '../../controllers/management/expenses'
import { validate } from '../../middleware/validate'
import { CreateExpenseSchema, UpdateExpenseSchema } from '../../validators/management'

const router = express.Router()
const requireAuth = (req: Request, res: Response, next: NextFunction) => (req.user ? next() : res.status(401).json({ success: false, error: 'Unauthorized' }))

router.use(requireAuth)
router.get('/', ExpensesController.index)
router.post('/', validate(CreateExpenseSchema), ExpensesController.store)
router.put('/:id', validate(UpdateExpenseSchema), ExpensesController.update)
router.delete('/:id', ExpensesController.destroy)

export default router
