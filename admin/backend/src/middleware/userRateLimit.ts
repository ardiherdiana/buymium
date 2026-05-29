import rateLimit from 'express-rate-limit'
import { Request } from 'express'
import { securityLogger } from '../utils/securityLogger'

// Per-user rate limit (applied after requireAuth/requireAdmin)
// Falls back to IP if user is not yet authenticated
export const userRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.user?.userId?.toString() ?? req.ip ?? 'unknown'
  },
  handler: (req, res) => {
    const id = req.user?.userId?.toString() ?? req.ip ?? 'unknown'
    securityLogger.rateLimitHit(id, req.path)
    res.status(429).json({ error: 'Terlalu banyak permintaan', retryAfter: '15 menit' })
  },
})
