import express from 'express'
import { JobSourcesController } from '../../controllers/management/jobSources'
import { validate } from '../../middleware/validate'
import { CreateJobSourceSchema, UpdateJobSourceSchema } from '../../validators/management'

const router = express.Router()

router.get('/', JobSourcesController.index)
router.post('/', validate(CreateJobSourceSchema), JobSourcesController.store)
router.put('/:id', validate(UpdateJobSourceSchema), JobSourcesController.update)
router.delete('/:id', JobSourcesController.destroy)
router.post('/sync', JobSourcesController.sync)

export default router
