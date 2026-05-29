import { Response } from 'express'

export function sendError(res: Response, status: number, message: string, details?: unknown) {
  res.status(status).json({
    success: false,
    error: message,
    ...(details ? { details } : {}),
  })
}

export function sendSuccess(res: Response, data: unknown, status = 200) {
  res.status(status).json({
    success: true,
    data,
  })
}

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}
