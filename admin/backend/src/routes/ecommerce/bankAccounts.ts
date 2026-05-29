import { Router } from 'express'
import { requireAdmin } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { CreateBankAccountSchema, UpdateBankAccountSchema } from '../../validators/ecommerce'
import { BankAccountsController } from '../../controllers/ecommerce/bankAccounts'

const router = Router()

router.get('/', requireAdmin, BankAccountsController.index)
router.post('/', requireAdmin, validate(CreateBankAccountSchema), BankAccountsController.create)
router.patch('/:id', requireAdmin, validate(UpdateBankAccountSchema), BankAccountsController.update)
router.delete('/:id', requireAdmin, BankAccountsController.destroy)

export default router
