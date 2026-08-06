import express from 'express'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import { JobAccountsController } from '../../controllers/management/jobAccounts'

const uuidv4 = () => crypto.randomUUID()

const router = express.Router()

const proofUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('File harus berupa gambar JPG/PNG/WEBP'))
  },
})

router.get('/', JobAccountsController.index)
router.get('/hp-counts', JobAccountsController.hpCounts)
router.post('/pay', JobAccountsController.pay)
router.post('/upload-proof', proofUpload.single('proof'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'File bukti transfer wajib diunggah' })
    return
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}` })
})

export default router
