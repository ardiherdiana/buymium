import dotenv from 'dotenv'
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[Security] JWT_SECRET is missing or too short (minimum 32 characters). Exiting.')
  process.exit(1)
}

import app from './app'

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
})
