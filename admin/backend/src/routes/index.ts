import { Router } from 'express'
import authRoutes from './auth'
import rolesRoutes from './roles'
import ecommerceRouter from './ecommerce/index'
import autopostingRouter from './autoposting/index'
import managementRouter from './management/index'

const router = Router()

// Auth routes
router.use('/auth', authRoutes)
router.use('/roles', rolesRoutes)

// Ecommerce routes
router.use('/', ecommerceRouter)

// Feature module routes
router.use('/autoposting', autopostingRouter)
router.use('/management', managementRouter)

export default router
