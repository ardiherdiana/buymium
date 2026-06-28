import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { securityLogger } from '../utils/securityLogger'

export interface JwtPayload {
  userId: number
  email: string
  roleName: string
  roleId: number
}

function getSecret(): string {
  return process.env.JWT_SECRET!
}

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  const ip = getClientIp(req)

  if (!token) {
    securityLogger.unauthorized(req.path, ip, req.method)
    res.status(401).json({ success: false, error: 'Missing authorization token' })
    return
  }

  try {
    const payload = jwt.verify(token, getSecret()) as JwtPayload
    req.user = payload
    next()
  } catch (err) {
    securityLogger.unauthorized(req.path, ip, req.method)
    res.status(401).json({ success: false, error: 'Invalid token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  const ip = getClientIp(req)

  if (!token) {
    securityLogger.unauthorized(req.path, ip, req.method)
    res.status(401).json({ success: false, error: 'Missing authorization token' })
    return
  }

  try {
    const payload = jwt.verify(token, getSecret()) as JwtPayload

    if (payload.roleName !== 'admin') {
      securityLogger.forbidden(payload.userId, req.path, ip)
      res.status(403).json({ success: false, error: 'Admin access required' })
      return
    }

    req.user = payload
    next()
  } catch (err) {
    securityLogger.unauthorized(req.path, ip, req.method)
    res.status(401).json({ success: false, error: 'Invalid token' })
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  return requireAdmin(req, res, next)
}

export function generateToken(userId: number, email: string, roleName: string, roleId: number): string {
  return jwt.sign(
    { userId, email, roleName, roleId },
    getSecret(),
    { expiresIn: '7d' }
  )
}

export function generateRefreshToken(userId: number, email: string, roleName: string, roleId: number): string {
  return jwt.sign(
    { userId, email, roleName, roleId, type: 'refresh' },
    getSecret(),
    { expiresIn: '14d' }
  )
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload
}
