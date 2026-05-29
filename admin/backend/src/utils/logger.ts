export const logger = {
  info(message: string, data?: unknown) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || '')
  },
  warn(message: string, data?: unknown) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data || '')
  },
  error(message: string, error?: unknown) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '')
  },
  debug(message: string, data?: unknown) {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data || '')
    }
  },
}
