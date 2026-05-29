import rateLimit from 'express-rate-limit'
import { securityLogger } from '../utils/securityLogger'

// Auth route rate limiter: 20 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
    securityLogger.rateLimitHit(ip, req.path)
    res.status(options.statusCode).json(options.message)
  },
})

// General API rate limiter: 500 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
    securityLogger.rateLimitHit(ip, req.path)
    res.status(options.statusCode).json(options.message)
  },
})
