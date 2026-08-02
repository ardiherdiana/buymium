import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
const uuidv4 = () => crypto.randomUUID()
import { requireAdmin } from '../../middleware/auth'
import { getChannels, deleteChannel } from '../../controllers/autoposting/channels'
import { getSchedules, updateSchedules } from '../../controllers/autoposting/schedules'
import { getPosts, createPost, updatePost, deletePost, deleteAllPosts } from '../../controllers/autoposting/posts'
import { generateCaption } from '../../controllers/autoposting/ai'
import { getChannelAnalytics, getTiktokLeaderboard } from '../../controllers/autoposting/analytics'

const router = Router()

router.use(requireAdmin)

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Tipe file tidak diizinkan'))
      return
    }
    cb(null, true)
  },
})

// Channels
router.get('/channels', getChannels)
router.delete('/channels/:id', deleteChannel)

// Schedules
router.get('/schedules', getSchedules)
router.put('/schedules', updateSchedules)

// Posts
router.get('/posts', getPosts)
router.post('/posts', upload.single('file'), createPost)
router.put('/posts/:id', upload.single('file'), updatePost)
router.delete('/posts', deleteAllPosts)
router.delete('/posts/:id', deletePost)

// AI
router.post('/ai/caption', generateCaption)

// Analytics
router.get('/analytics/leaderboard', getTiktokLeaderboard)
router.get('/analytics', getChannelAnalytics)

export default router
