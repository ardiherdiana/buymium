import { Router } from 'express'
import ordersRouter from './orders'
import productsRouter from './products'
import stocksRouter from './stocks'
import sectionsRouter from './sections'
import usersRouter from './users'
import statsRouter from './stats'
import bankAccountsRouter from './bankAccounts'
import testimonialsRouter from './testimonials'

const router = Router()

router.use('/orders', ordersRouter)
router.use('/products', productsRouter)
router.use('/stocks', stocksRouter)
router.use('/sections', sectionsRouter)
router.use('/users', usersRouter)
router.use('/stats', statsRouter)
router.use('/bank-accounts', bankAccountsRouter)
router.use('/testimonials', testimonialsRouter)

export default router
