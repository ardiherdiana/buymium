import express from 'express'
import { SourcesController } from '../../controllers/management/sources'
import { validate } from '../../middleware/validate'
import { CreateSourceSchema, UpdateSourceSchema } from '../../validators/management'

const router = express.Router()

router.get('/', SourcesController.index)
router.post('/', validate(CreateSourceSchema), SourcesController.store)
router.put('/:id', validate(UpdateSourceSchema), SourcesController.update)
router.delete('/:id', SourcesController.destroy)

export default router
