import { Router, Request, Response } from 'express'
import db from '../config/database'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, referralCode: true, referralBalance: true },
  })
  if (!user) { res.status(404).json({ error: 'User tidak ditemukan' }); return }

  const referredUsers = await db.user.findMany({
    where: { referredById: userId },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const paidFromReferrals = await db.order.findMany({
    where: { user: { referredById: userId }, status: 'paid' },
    select: { id: true, totalPrice: true, confirmedAt: true, user: { select: { name: true, email: true } } },
    orderBy: { confirmedAt: 'desc' },
    take: 30,
  })

  res.json({
    referralCode: user.referralCode,
    referralBalance: user.referralBalance,
    totalReferred: referredUsers.length,
    totalEarned: paidFromReferrals.reduce((s, o) => s + Math.round(o.totalPrice * 0.05), 0),
    referrals: referredUsers,
    recentCommissions: paidFromReferrals.map(o => ({
      orderId: o.id,
      total: o.totalPrice,
      commission: Math.round(o.totalPrice * 0.05),
      confirmedAt: o.confirmedAt,
      buyerName: o.user.name,
    })),
  })
})

router.get('/validate/:code', async (req: Request, res: Response) => {
  const code = String(req.params.code)
  const user = await db.user.findUnique({
    where: { referralCode: code },
    select: { id: true, name: true },
  })
  if (!user) { res.status(404).json({ valid: false }); return }
  res.json({ valid: true, referrerName: user.name })
})

export default router
