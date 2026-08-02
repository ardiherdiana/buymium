import express from 'express'
import { RolesController } from '../../controllers/management/roles'
import { requireAdmin } from '../../middleware/auth'

const router = express.Router()

router.use(requireAdmin)
router.get('/', RolesController.index)
router.post('/', RolesController.store)
router.put('/:id', RolesController.update)
router.delete('/:id', RolesController.destroy)

export default router
