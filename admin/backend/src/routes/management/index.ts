import express from 'express'
import { requireAdmin } from '../../middleware/auth'
import { userRateLimit } from '../../middleware/userRateLimit'
import accountsRouter from './accounts'
import customersRouter from './customers'
import dashboardRouter from './dashboard'
import analyticsRouter from './analytics'
import rolesRouter from './roles'
import usersRouter from './users'
import sourcesRouter from './sources'
import salesRouter from './sales'
import upfollVendorsRouter from './upfollVendors'
import upfollOrdersRouter from './upfollOrders'
import jobSourcesRouter from './jobSources'
import jobAccountsRouter from './jobAccounts'

const router = express.Router()

router.use(requireAdmin)
router.use(userRateLimit)

router.use('/accounts', accountsRouter)
router.use('/customers', customersRouter)
router.use('/dashboard', dashboardRouter)
router.use('/analytics', analyticsRouter)
router.use('/roles', rolesRouter)
router.use('/users', usersRouter)
router.use('/sources', sourcesRouter)
router.use('/sales', salesRouter)
router.use('/upfoll-vendors', upfollVendorsRouter)
router.use('/upfoll-orders', upfollOrdersRouter)
router.use('/job-sources', jobSourcesRouter)
router.use('/job-accounts', jobAccountsRouter)

export default router
