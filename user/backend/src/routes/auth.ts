import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { OAuth2Client, TokenPayload } from 'google-auth-library'
import db from '../config/database'
import { signToken, signRefreshToken, verifyToken, requireAuth, type JwtPayload } from '../middleware/auth'
import { securityLogger } from '../utils/securityLogger'
import { validate } from '../middleware/validate'
import { LoginSchema, GoogleAuthSchema } from '../validators'
import { generateReferralCode } from '../utils/referral'

async function ensureUniqueReferralCode(seed?: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateReferralCode(seed)
    const existing = await db.user.findUnique({ where: { referralCode: code } })
    if (!existing) return code
  }
  return generateReferralCode() + Date.now().toString(36).slice(-3).toUpperCase()
}

const router = Router()
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

router.post('/login', validate(LoginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body
  const ip = req.ip ?? 'unknown'

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    securityLogger.loginFailed(email, ip, 'user not found')
    res.status(401).json({ error: 'Email atau password salah' })
    return
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    securityLogger.loginFailed(email, ip, 'wrong password')
    res.status(401).json({ error: 'Email atau password salah' })
    return
  }

  securityLogger.loginSuccess(user.id, user.email, ip)
  const payload = { userId: user.id, email: user.email, roleId: user.roleId }
  const token = signToken(payload)
  const refreshToken = signRefreshToken(payload)
  res.json({
    token,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, roleId: user.roleId, avatar: user.avatar },
  })
})

router.post('/google', validate(GoogleAuthSchema), async (req: Request, res: Response) => {
  const { credential, referralCode } = req.body as { credential: string; referralCode?: string }
  const ip = req.ip ?? 'unknown'

  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: 'GOOGLE_CLIENT_ID belum dikonfigurasi di server' })
    return
  }

  let payload: TokenPayload | undefined

  const isIdToken = credential.split('.').length === 3

  if (isIdToken) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      payload = ticket.getPayload()
    } catch {
      securityLogger.loginFailed('google-auth', ip, 'invalid google id token')
      res.status(401).json({ error: 'Google token tidak valid' })
      return
    }
  } else {
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${credential}` },
      })
      if (!userInfoRes.ok) throw new Error('invalid access token')
      const info = await userInfoRes.json() as { sub: string; email: string; name: string; picture: string; email_verified: boolean }
      payload = {
        sub: info.sub,
        email: info.email,
        name: info.name,
        picture: info.picture,
        email_verified: info.email_verified,
      } as TokenPayload
    } catch {
      securityLogger.loginFailed('google-auth', ip, 'invalid google access token')
      res.status(401).json({ error: 'Google token tidak valid' })
      return
    }
  }

  if (!payload) {
    securityLogger.loginFailed('google-auth', ip, 'empty google payload')
    res.status(401).json({ error: 'Google token tidak valid' })
    return
  }

  const { sub: googleId, email, name, picture } = payload

  if (!email) {
    res.status(400).json({ error: 'Email tidak tersedia dari Google' })
    return
  }

  let user = await db.user.findUnique({ where: { email } })

  if (!user) {
    let referredById: number | undefined
    if (referralCode) {
      const referrer = await db.user.findUnique({ where: { referralCode } })
      if (referrer) referredById = referrer.id
    }

    const newReferralCode = await ensureUniqueReferralCode(name ?? email)

    user = await db.user.create({
      data: {
        name: name ?? email,
        email,
        password: '',
        roleId: 3,
        googleId,
        avatar: picture ?? '',
        referralCode: newReferralCode,
        referredById,
      },
    })
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        googleId: user.googleId ?? googleId,
        avatar: picture ?? user.avatar,
        referralCode: user.referralCode ?? (await ensureUniqueReferralCode(user.name)),
      },
    })
  }

  securityLogger.loginSuccess(user.id, user.email, ip)
  const jwtPayload = { userId: user.id, email: user.email, roleId: user.roleId }
  const token = signToken(jwtPayload)
  const refreshToken = signRefreshToken(jwtPayload)
  res.json({
    token,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, roleId: user.roleId, avatar: user.avatar },
  })
})

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token diperlukan' })
    return
  }

  try {
    const payload = verifyToken(refreshToken) as JwtPayload & { type?: string }

    if (payload.type !== 'refresh') {
      res.status(401).json({ error: 'Token tidak valid' })
      return
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, roleId: true },
    })

    if (!user) {
      res.status(401).json({ error: 'User tidak ditemukan' })
      return
    }

    const newPayload = { userId: user.id, email: user.email, roleId: user.roleId }
    const newToken = signToken(newPayload)
    const newRefreshToken = signRefreshToken(newPayload)

    res.json({ token: newToken, refreshToken: newRefreshToken })
  } catch {
    res.status(401).json({ error: 'Refresh token tidak valid atau sudah kadaluarsa' })
  }
})

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, roleId: true, avatar: true, createdAt: true },
  })

  if (!user) {
    res.status(404).json({ error: 'User tidak ditemukan' })
    return
  }

  res.json(user)
})

export default router
