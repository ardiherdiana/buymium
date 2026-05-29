import express from 'express'

export function globalErrorHandler(err: { status?: number; statusCode?: number; message?: string }, req: express.Request, res: express.Response, next: express.NextFunction) {
  console.error('[Error]', err)
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'
  res.status(status).json({ success: false, error: message })
}

export function notFoundHandler(req: express.Request, res: express.Response) {
  res.status(404).json({ success: false, error: 'Route not found' })
}
