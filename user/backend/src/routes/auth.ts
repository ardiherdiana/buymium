import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { OAuth2Client, TokenPayload } from 'google-auth-library'
import db from '../config/database'
import { signToken, signRefreshToken, verifyToken, requireAuth, type JwtPayload } from '../middleware/auth'
import { securityLogger } from '../utils/securityLogger'
import { validate } from '../middleware/validate'
import { LoginSchema, GoogleAuthSchema, RegisterSchema, OtpVerifySchema, ForgotPasswordSchema, ResetPasswordSchema, UpdateProfileSchema, ChangePasswordSchema } from '../validators'
import { sendOtpEmail, sendResetPasswordOtpEmail } from '../utils/email'

const router = Router()
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

interface RegistrationPayload {
  name: string
  hashedPassword: string
}

async function createOtpToken(email: string, purpose: 'register' | 'reset', payload?: unknown): Promise<string> {
  await db.otpToken.deleteMany({ where: { email, purpose } })
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const codeHash = await bcrypt.hash(otp, 10)
  await db.otpToken.create({
    data: {
      email,
      purpose,
      codeHash,
      payload: payload !== undefined ? JSON.stringify(payload) : null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })
  return otp
}

async function consumeOtpToken<T>(email: string, purpose: 'register' | 'reset', otp: string): Promise<{ ok: true; payload: T | null } | { ok: false; error: string }> {
  const pending = await db.otpToken.findFirst({ where: { email, purpose }, orderBy: { createdAt: 'desc' } })
  if (!pending) return { ok: false, error: 'notfound' }
  if (pending.expiresAt < new Date()) {
    await db.otpToken.delete({ where: { id: pending.id } })
    return { ok: false, error: 'expired' }
  }
  const valid = await bcrypt.compare(otp, pending.codeHash)
  if (!valid) return { ok: false, error: 'mismatch' }
  await db.otpToken.delete({ where: { id: pending.id } })
  return { ok: true, payload: pending.payload ? (JSON.parse(pending.payload) as T) : null }
}

router.post('/register', validate(RegisterSchema), async (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.' })
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const otp = await createOtpToken(email, 'register', { name, hashedPassword } satisfies RegistrationPayload)

  await sendOtpEmail({ to: email, name, otp })

  res.json({ message: 'OTP dikirim ke email kamu. Berlaku 10 menit.' })
})

router.post('/verify-otp', validate(OtpVerifySchema), async (req: Request, res: Response) => {
  const { email, otp } = req.body as { email: string; otp: string }

  const result = await consumeOtpToken<RegistrationPayload>(email, 'register', otp)
  if (!result.ok || !result.payload) {
    const error = !result.ok && result.error === 'expired'
      ? 'Kode OTP sudah kadaluarsa. Daftar ulang untuk mendapat kode baru.'
      : !result.ok && result.error === 'mismatch'
      ? 'Kode OTP salah. Periksa kembali email kamu.'
      : 'Tidak ada permintaan pendaftaran untuk email ini. Daftar ulang.'
    res.status(400).json({ error })
    return
  }
  const pending = result.payload

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

  const existingToken = await db.otpToken.findFirst({ where: { email, purpose: 'register' }, orderBy: { createdAt: 'desc' } })
  if (existingToken?.payload) {
    const pending = JSON.parse(existingToken.payload) as RegistrationPayload
    const newOtp = await createOtpToken(email, 'register', pending)
    await sendOtpEmail({ to: email, name: pending.name, otp: newOtp })
  }

  res.json({ message: 'Jika ada sesi pendaftaran aktif untuk email ini, kode OTP baru telah dikirim.' })
})

router.post('/forgot-password', validate(ForgotPasswordSchema), async (req: Request, res: Response) => {
  const { email } = req.body as { email: string }

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !user.password) {
    res.json({ message: 'Jika email terdaftar, kode OTP akan dikirim.' })
    return
  }

  const otp = await createOtpToken(email, 'reset', { userId: user.id })

  await sendResetPasswordOtpEmail({ to: user.email, name: user.name, otp })

  res.json({ message: 'Jika email terdaftar, kode OTP akan dikirim.' })
})

router.post('/reset-password', validate(ResetPasswordSchema), async (req: Request, res: Response) => {
  const { email, otp, password } = req.body as { email: string; otp: string; password: string }

  const result = await consumeOtpToken<{ userId: number }>(email, 'reset', otp)
  if (!result.ok || !result.payload) {
    res.status(400).json({ error: 'Kode OTP tidak valid atau sudah kadaluarsa. Minta kode baru.' })
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await db.user.update({ where: { id: result.payload.userId }, data: { password: hashedPassword } })

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
