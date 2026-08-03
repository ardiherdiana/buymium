import express from 'express'
import { JobAccountsController } from '../../controllers/management/jobAccounts'

const router = express.Router()

router.get('/', JobAccountsController.index)

export default router
