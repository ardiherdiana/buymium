import { Router } from 'express'
import { requireAdmin } from '../../middleware/auth'
import { TestimonialController } from '../../controllers/testimonial'

const router = Router()

router.get('/', requireAdmin, TestimonialController.index)
router.post('/', requireAdmin, TestimonialController.create)
router.patch('/:id', requireAdmin, TestimonialController.update)
router.delete('/:id', requireAdmin, TestimonialController.destroy)

export default router
