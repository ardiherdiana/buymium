import express, { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { SourcesController } from '../../controllers/management/sources'
import { validate } from '../../middleware/validate'
import { CreateSourceSchema, UpdateSourceSchema } from '../../validators/management'

const router = express.Router()
const requireAuth = (req: Request, res: Response, next: NextFunction) => (req.user ? next() : res.status(401).json({ success: false, error: 'Unauthorized' }))

// Setup multer for image uploads
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'sources')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

router.use(requireAuth)
router.get('/', SourcesController.index)
router.post('/', upload.single('image'), validate(CreateSourceSchema), SourcesController.store)
router.put('/:id', upload.single('image'), validate(UpdateSourceSchema), SourcesController.update)
router.delete('/:id', SourcesController.destroy)

export default router
