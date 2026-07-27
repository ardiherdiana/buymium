import 'express-async-errors'
import express from 'express'
import multer from 'multer'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'

import authRoutes from './routes/auth'
import productRoutes from './routes/products'
import orderRoutes from './routes/orders'
import bankAccountRoutes from './routes/bankAccounts'
import sitemapRoutes from './routes/sitemap'
import testimonialRoutes from './routes/testimonials'

import { securityLogger } from './utils/securityLogger'

const app = express()

app.set('trust proxy', 1)

app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
}))

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000']

app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin) return callback(null, true)
    const allowed = process.env.NODE_ENV === 'production' ? [process.env.FRONTEND_URL ?? ''] : DEV_ORIGINS
    if (allowed.includes(origin)) callback(null, true)
    else callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.rateLimitHit(req.ip ?? 'unknown', req.path)
    res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi nanti.' })
  },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.rateLimitHit(req.ip ?? 'unknown', req.path)
    res.status(429).json({ error: 'Terlalu banyak percobaan login, coba lagi nanti.' })
  },
})

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.rateLimitHit(req.ip ?? 'unknown', req.path)
    res.status(429).json({ error: 'Terlalu banyak permintaan refresh token, coba lagi nanti.' })
  },
})

app.use('/api', generalLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/google', authLimiter)
app.use('/api/auth/resend-otp', authLimiter)
app.use('/api/auth/refresh', refreshLimiter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  next()
}, express.static(path.join(process.cwd(), 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/bank-accounts', bankAccountRoutes)
app.use('/sitemap.xml', sitemapRoutes)
app.use('/api/testimonials', testimonialRoutes)

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return

  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 5MB' : err.message })
    return
  }
  if (err.message === 'File harus berupa gambar JPG/PNG/WEBP') {
    res.status(400).json({ error: err.message })
    return
  }
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'Origin tidak diizinkan' })
    return
  }

  console.error('[UnhandledError]', err)
  res.status(500).json({ error: 'Terjadi kesalahan pada server. Silakan coba lagi nanti.' })
})

export default app
