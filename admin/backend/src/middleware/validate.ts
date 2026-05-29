import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      const firstMessage = errors[0]?.message || 'Validation failed'
      res.status(400).json({ error: firstMessage, errors })
      return
    }
    req.body = result.data
    next()
  }
}
