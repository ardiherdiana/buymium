import { Router, Request, Response } from 'express'
import path from 'path'
import db from '../config/database'
import { verifyToken } from '../middleware/auth'
import { verifyFileToken } from '../utils/fileAccessToken'

const router = Router()
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'payment-proofs')

// Payment proof images are private (customer bank transfer receipts). Access requires
// either a short-lived signed token (used by <img> tags in admin/user frontends) or a
// Bearer token belonging to the order's owner / an admin.
router.get('/payment-proofs/:filename', async (req: Request, res: Response) => {
  const filename = path.basename(String(req.params.filename))
  const relativePath = `payment-proofs/${filename}`
  const filePath = path.join(UPLOAD_DIR, filename)

  const serve = () => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'File tidak ditemukan' })
    })
  }

  const token = req.query.token as string | undefined
  if (token && verifyFileToken(relativePath, token)) {
    serve()
    return
  }

  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(authHeader.slice(7))
      if (payload.roleId === 1) {
        serve()
        return
      }
      const order = await db.order.findFirst({
        where: { userId: payload.userId, paymentProof: `uploads/${relativePath}` },
        select: { id: true },
      })
      if (order) {
        serve()
        return
      }
    } catch {
      // fall through to 403
    }
  }

  res.status(403).json({ error: 'Akses ditolak' })
})

export default router
