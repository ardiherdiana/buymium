import './config/env'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger'
import { securityLogger } from './utils/securityLogger'
import apiRouter from './routes/index'

const app = express()
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

app.use(helmet())

// Auth route rate limiter: 20 attempts per 15 minutes
const authLimiter = rateLimit({
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
const apiLimiter = rateLimit({
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

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:3000']

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin) return callback(null, true)
    const allowed = process.env.NODE_ENV === 'production' ? [FRONTEND_URL] : DEV_ORIGINS
    if (allowed.includes(origin)) callback(null, true)
    else callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'admin-backend' })
})

// Rate limiting
app.use('/api/auth/login', authLimiter)
app.use('/api/', apiLimiter)

// API Docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec))

// All routes via master router
app.use('/api', apiRouter)

// Error handling
app.use((err: { status?: number; statusCode?: number; message?: string }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err)
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'
  res.status(status).json({ success: false, error: message })
})

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

export default app
