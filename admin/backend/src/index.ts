import app from './app'

// Services
import { startScheduler } from './services/scheduler'
import { startCleanup } from './services/cleanup'

const PORT = process.env.PORT || 5001

// Start background services
startScheduler()
startCleanup()

// Start server
app.listen(PORT, () => {
  console.log(`[Admin Backend] Running on http://localhost:${PORT}`)
  console.log(`[Admin Backend] Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
