import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { securityLogger } from '../utils/securityLogger'

function getSecret(): string {
  return process.env.JWT_SECRET!
}

export interface JwtPayload {
  userId: number
  email: string
  roleId: number
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '1h' })
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: 'refresh' }, getSecret(), { expiresIn: '14d' })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    securityLogger.unauthorized(req.path, req.ip ?? 'unknown', req.method)
    res.status(401).json({ error: 'Tidak diizinkan' })
    return
  }
  const token = authHeader.slice(7)
  try {
    const payload = verifyToken(token)
    req.user = payload
    next()
  } catch {
    securityLogger.unauthorized(req.path, req.ip ?? 'unknown', req.method)
    res.status(401).json({ error: 'Token tidak valid' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const user = req.user
    if (!user || user.roleId !== 1) {
      securityLogger.forbidden(user?.userId ?? 0, req.path, req.ip ?? 'unknown')
      res.status(403).json({ error: 'Akses ditolak' })
      return
    }
    next()
  })
}
