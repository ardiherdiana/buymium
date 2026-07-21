import express, { Request, Response, NextFunction } from 'express'
import { UpfollVendorsController } from '../../controllers/management/upfollVendors'
import { validate } from '../../middleware/validate'
import {
  CreateUpfollVendorSchema,
  UpdateUpfollVendorSchema,
  CreateUpfollVendorTierSchema,
  UpdateUpfollVendorTierSchema,
} from '../../validators/management'

const router = express.Router()
const requireAuth = (req: Request, res: Response, next: NextFunction) => (req.user ? next() : res.status(401).json({ success: false, error: 'Unauthorized' }))

router.use(requireAuth)
router.get('/', UpfollVendorsController.index)
router.get('/:id', UpfollVendorsController.show)
router.post('/', validate(CreateUpfollVendorSchema), UpfollVendorsController.store)
router.put('/:id', validate(UpdateUpfollVendorSchema), UpfollVendorsController.update)
router.delete('/:id', UpfollVendorsController.destroy)

router.post('/:id/tiers', validate(CreateUpfollVendorTierSchema), UpfollVendorsController.storeTier)
router.put('/tiers/:vendorTierId', validate(UpdateUpfollVendorTierSchema), UpfollVendorsController.updateTier)
router.delete('/tiers/:vendorTierId', UpfollVendorsController.destroyTier)

export default router
