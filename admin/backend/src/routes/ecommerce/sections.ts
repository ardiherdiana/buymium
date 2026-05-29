import { Router } from 'express'
import { requireAdmin } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { CreateSectionSchema, UpdateSectionSchema } from '../../validators/ecommerce'
import { SectionsController } from '../../controllers/ecommerce/sections'

const router = Router()

// GET /api/sections
router.get('/', requireAdmin, SectionsController.index)

// GET /api/sections/:id
router.get('/:id', requireAdmin, SectionsController.show)

// POST /api/sections
router.post('/', requireAdmin, validate(CreateSectionSchema), SectionsController.create)

// PUT /api/sections/:id
router.put('/:id', requireAdmin, validate(UpdateSectionSchema), SectionsController.update)

// DELETE /api/sections/:id
router.delete('/:id', requireAdmin, SectionsController.destroy)

export default router
