import { Router } from 'express'
import { requireAdmin } from '../../middleware/auth'
import { StatsController } from '../../controllers/ecommerce/stats'

const router = Router()

// GET /api/admin/stats - Dashboard statistics
router.get('/', requireAdmin, StatsController.index)

// GET /api/admin/stats/orders - Order statistics
router.get('/orders', requireAdmin, StatsController.orders)

// GET /api/admin/stats/revenue - Revenue statistics
router.get('/revenue', requireAdmin, StatsController.revenue)

export default router
