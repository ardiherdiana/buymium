import dotenv from 'dotenv'
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[Security] JWT_SECRET is missing or too short (minimum 32 characters). Exiting.')
  process.exit(1)
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error('[Security] ENCRYPTION_KEY is missing or invalid (must be a 64-character hex string). Exiting.')
  process.exit(1)
}

import app from './app'
import { startOrderExpiryJob } from './services/orderExpiry'
import { startAutoRatingJob } from './services/autoRating'

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  startOrderExpiryJob()
  startAutoRatingJob()
})
