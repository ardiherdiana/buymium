import { Router } from 'express'
import { requireAdmin } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { CreateStockSchema, BulkStockSchema, UpdateStockSchema } from '../../validators/ecommerce'
import { StocksController } from '../../controllers/ecommerce/stocks'

const router = Router()

// Specific routes BEFORE /:id to prevent Express matching them as id params
// GET /api/stocks/product/:productId - List stocks for a product
router.get('/product/:productId', requireAdmin, StocksController.byProduct)

// POST /api/stocks/bulk - Mass upload stocks
router.post('/bulk', requireAdmin, validate(BulkStockSchema), StocksController.bulkCreate)

// GET /api/stocks - List stocks with pagination
router.get('/', requireAdmin, StocksController.index)

// GET /api/stocks/:id - Get stock detail
router.get('/:id', requireAdmin, StocksController.show)

// POST /api/stocks - Create stock
router.post('/', requireAdmin, validate(CreateStockSchema), StocksController.create)

// PATCH /api/stocks/:id - Update stock
router.patch('/:id', requireAdmin, validate(UpdateStockSchema), StocksController.update)

// DELETE /api/stocks/:id - Delete stock
router.delete('/:id', requireAdmin, StocksController.destroy)

export default router
