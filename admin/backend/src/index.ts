import app from './app'
import { logger } from './utils/logger'

// Services
import { startScheduler } from './services/scheduler'
import { startCleanup } from './services/cleanup'

const PORT = process.env.PORT || 5001

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET is missing or too short (minimum 32 characters)')
}
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY is missing or invalid (must be a 64-character hex string)')
}

// Start background services
startScheduler()
startCleanup()

// Start server
app.listen(PORT, () => {
  logger.info(`[Admin Backend] Running on http://localhost:${PORT}`)
  logger.info(`[Admin Backend] Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
