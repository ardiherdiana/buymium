import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { OAuth2Client, TokenPayload } from 'google-auth-library'
import db from '../config/database'
import { signToken, signRefreshToken, verifyToken, requireAuth, type JwtPayload } from '../middleware/auth'
import { securityLogger } from '../utils/securityLogger'
import { validate } from '../middleware/validate'
import { LoginSchema, GoogleAuthSchema, RegisterSchema, OtpVerifySchema, ForgotPasswordSchema, ResetPasswordSchema, UpdateProfileSchema, ChangePasswordSchema } from '../validators'
import { sendOtpEmail, sendResetPasswordEmail } from '../utils/email'
import crypto from 'crypto'

const router = Router()
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// In-memory OTP store: email -> { otp, hashedPassword, name, expiresAt }
interface PendingRegistration {
  otp: string
  name: string
  hashedPassword: string
  expiresAt: number
}
const pendingRegistrations = new Map<string, PendingRegistration>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [email, entry] of pendingRegistrations.entries()) {
    if (entry.expiresAt < now) pendingRegistrations.delete(email)
  }
}, 60_000)

// In-memory reset token store: token -> { userId, email, expiresAt }
interface PendingReset {
  userId: number
  email: string
  expiresAt: number
}
const pendingResets = new Map<string, PendingReset>()

setInterval(() => {
  const now = Date.now()
  for (const [token, entry] of pendingResets.entries()) {
    if (entry.expiresAt < now) pendingResets.delete(token)
  }
}, 60_000)

router.post('/register', validate(RegisterSchema), async (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.' })
    return
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const hashedPassword = await bcrypt.hash(password, 12)

  pendingRegistrations.set(email, {
    otp,
    name,
    hashedPassword,
    expiresAt: Date.now() + 10 * 60 * 1000,
  })

  await sendOtpEmail({ to: email, name, otp })

  res.json({ message: 'OTP dikirim ke email kamu. Berlaku 10 menit.' })
})

router.post('/verify-otp', validate(OtpVerifySchema), async (req: Request, res: Response) => {
  const { email, otp } = req.body as { email: string; otp: string }

  const pending = pendingRegistrations.get(email)
  if (!pending) {
    res.status(400).json({ error: 'Tidak ada permintaan pendaftaran untuk email ini. Daftar ulang.' })
    return
  }
  if (pending.expiresAt < Date.now()) {
    pendingRegistrations.delete(email)
    res.status(400).json({ error: 'Kode OTP sudah kadaluarsa. Daftar ulang untuk mendapat kode baru.' })
    return
  }
  if (pending.otp !== otp) {
    res.status(400).json({ error: 'Kode OTP salah. Periksa kembali email kamu.' })
    return
  }

  pendingRegistrations.delete(email)

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email sudah terdaftar.' })
    return
  }

  const user = await db.user.create({
    data: {
      name: pending.name,
      email,
      password: pending.hashedPassword,
      roleId: 3,
    },
  })

  const payload = { userId: user.id, email: user.email, roleId: user.roleId }
  const token = signToken(payload)
  const refreshToken = signRefreshToken(payload)
  res.status(201).json({
    token,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, roleId: user.roleId, avatar: user.avatar, hasPassword: true },
  })
})

router.post('/resend-otp', async (req: Request, res: Response) => {
  const { email } = req.body as { email: string }
  if (!email) { res.status(400).json({ error: 'Email diperlukan' }); return }

  const pending = pendingRegistrations.get(email)
  if (!pending) {
    res.status(400).json({ error: 'Tidak ada sesi pendaftaran aktif untuk email ini.' })
    return
  }

  const newOtp = Math.floor(100000 + Math.random() * 900000).toString()
  pendingRegistrations.set(email, { ...pending, otp: newOtp, expiresAt: Date.now() + 10 * 60 * 1000 })

  await sendOtpEmail({ to: email, name: pending.name, otp: newOtp })
  res.json({ message: 'Kode OTP baru telah dikirim.' })
})

router.post('/forgot-password', validate(ForgotPasswordSchema), async (req: Request, res: Response) => {
  const { email } = req.body as { email: string }

  const user = await db.user.findUnique({ where: { email } })
  // Always respond OK to prevent email enumeration
  if (!user || !user.password) {
    res.json({ message: 'Jika email terdaftar, link reset akan dikirim.' })
    return
  }

  const token = crypto.randomBytes(32).toString('hex')
  pendingResets.set(token, { userId: user.id, email: user.email, expiresAt: Date.now() + 30 * 60 * 1000 })

  const resetUrl = `${process.env.SITE_URL || 'https://buymium.id'}/reset-password?token=${token}`
  await sendResetPasswordEmail({ to: user.email, name: user.name, resetUrl })

  res.json({ message: 'Jika email terdaftar, link reset akan dikirim.' })
})

router.post('/reset-password', validate(ResetPasswordSchema), async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string }

  const pending = pendingResets.get(token)
  if (!pending || pending.expiresAt < Date.now()) {
    pendingResets.delete(token)
    res.status(400).json({ error: 'Link reset tidak valid atau sudah kadaluarsa. Minta link baru.' })
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await db.user.update({ where: { id: pending.userId }, data: { password: hashedPassword } })
  pendingResets.delete(token)

  res.json({ message: 'Password berhasil diubah. Silakan masuk dengan password baru.' })
})

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
    user: { id: user.id, name: user.name, email: user.email, roleId: user.roleId, avatar: user.avatar, hasPassword: true },
  })
})

router.post('/google', validate(GoogleAuthSchema), async (req: Request, res: Response) => {
  const { credential } = req.body as { credential: string }
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
    user = await db.user.create({
      data: {
        name: name ?? email,
        email,
        password: '',
        roleId: 3,
        googleId,
        avatar: picture ?? '',
      },
    })
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        googleId: user.googleId ?? googleId,
        avatar: picture ?? user.avatar,
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
    user: { id: user.id, name: user.name, email: user.email, roleId: user.roleId, avatar: user.avatar, hasPassword: !!user.password },
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
    select: { id: true, name: true, email: true, roleId: true, avatar: true, password: true, createdAt: true },
  })

  if (!user) {
    res.status(404).json({ error: 'User tidak ditemukan' })
    return
  }

  const { password, ...rest } = user
  res.json({ ...rest, hasPassword: !!password })
})

router.patch('/profile', requireAuth, validate(UpdateProfileSchema), async (req: Request, res: Response) => {
  const { userId } = req.user!
  const { name } = req.body as { name: string }

  const user = await db.user.update({
    where: { id: userId },
    data: { name },
    select: { id: true, name: true, email: true, roleId: true, avatar: true },
  })

  res.json({ user })
})

router.post('/change-password', requireAuth, validate(ChangePasswordSchema), async (req: Request, res: Response) => {
  const { userId } = req.user!
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword: string }

  const user = await db.user.findUnique({ where: { id: userId }, select: { password: true } })
  if (!user) {
    res.status(404).json({ error: 'User tidak ditemukan' })
    return
  }

  const hasPassword = !!user.password

  if (hasPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Password saat ini diperlukan' })
      return
    }
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      res.status(400).json({ error: 'Password saat ini tidak sesuai' })
      return
    }
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await db.user.update({ where: { id: userId }, data: { password: hashed } })

  res.json({ message: 'Password berhasil diubah.' })
})

export default router
