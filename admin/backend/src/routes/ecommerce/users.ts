import { Router } from 'express'
import { requireAdmin } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { UpdateUserRoleSchema } from '../../validators/ecommerce'
import { UsersController } from '../../controllers/ecommerce/users'

const router = Router()

// GET /api/admin/users - List users (roleId=2 only) dengan stats pembelian
router.get('/', requireAdmin, UsersController.index)

// GET /api/admin/users/growth - Daily new-user counts (must precede /:id)
router.get('/growth', requireAdmin, UsersController.growth)

// GET /api/admin/users/:id - Get user detail
router.get('/:id', requireAdmin, UsersController.show)

// PATCH /api/admin/users/:id/role - Update user role
router.patch('/:id/role', requireAdmin, validate(UpdateUserRoleSchema), UsersController.updateRole)

// DELETE /api/admin/users/:id - Delete user
router.delete('/:id', requireAdmin, UsersController.destroy)

export default router
