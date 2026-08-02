import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import db from '../config/database'
import { generateToken, generateRefreshToken, verifyToken, JwtPayload } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { LoginSchema } from '../validators/auth'
import { securityLogger } from '../utils/securityLogger'
import { logger } from '../utils/logger'

const router = Router()

// POST /api/auth/login - Admin login
router.post('/login', validate(LoginSchema), async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'

  try {
    const { email, password } = req.body

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        roleId: true,
        avatar: true,
        role: { select: { id: true, name: true } },
      },
    })

    if (!user) {
      securityLogger.loginFailed(email, ip, 'User not found')
      res.status(401).json({ success: false, error: 'Invalid credentials' })
      return
    }

    if (!['admin', 'superadmin'].includes(user.role.name)) {
      securityLogger.loginFailed(email, ip, 'Insufficient role')
      res.status(403).json({ success: false, error: 'Admin access only' })
      return
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      securityLogger.loginFailed(email, ip, 'Wrong password')
      res.status(401).json({ success: false, error: 'Invalid credentials' })
      return
    }

    securityLogger.loginSuccess(user.id, user.email, ip)
    const token = generateToken(user.id, user.email, user.role.name, user.roleId)
    const refreshToken = generateRefreshToken(user.id, user.email, user.role.name, user.roleId)

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        role: user.role.name,
        avatar: user.avatar,
      },
    })
  } catch (err) {
    logger.error('[Login Error]', err)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

// POST /api/auth/refresh - Renew access token using refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(401).json({ success: false, error: 'Refresh token required' })
    return
  }

  try {
    const payload: JwtPayload & { type?: string } = verifyToken(refreshToken) as JwtPayload & { type?: string }
    if (payload.type !== 'refresh') {
      res.status(401).json({ success: false, error: 'Invalid token type' })
      return
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, roleId: true, role: { select: { name: true } } },
    })

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' })
      return
    }

    const newToken = generateToken(user.id, user.email, user.role.name, user.roleId)
    const newRefreshToken = generateRefreshToken(user.id, user.email, user.role.name, user.roleId)

    res.json({ token: newToken, refreshToken: newRefreshToken })
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' })
  }
})

export default router
