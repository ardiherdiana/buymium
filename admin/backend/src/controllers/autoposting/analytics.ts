import { Request, Response } from 'express'
import db from '../../config/database'
import { logger } from '../../utils/logger'
const prisma = db
import * as socialbu from '../../services/socialbu'

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  }
}

// SocialBu only returns metrics up to today, leaving trailing days of the current
// month without a data point. Pad the series to the full month so it lines up with
// the posts-per-day chart, carrying the last known value forward for future days.
function padDailySeries(
  series: { date: string; value: number }[],
  start: Date,
  end: Date
): { date: string; value: number }[] {
  const byDate = new Map(series.map((p) => [p.date, p.value]))
  const padded: { date: string; value: number }[] = []
  let lastValue = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = formatDate(cursor)
    if (byDate.has(key)) lastValue = byDate.get(key) as number
    padded.push({ date: key, value: lastValue })
    cursor.setDate(cursor.getDate() + 1)
  }
  return padded
}

export async function getChannelAnalytics(req: Request, res: Response) {
  const channelId = req.query.channel_id ? parseInt(req.query.channel_id as string) : undefined
  if (!channelId) {
    res.status(400).json({ message: 'channel_id is required' })
    return
  }

  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel || !channel.socialBuId) {
    res.status(404).json({ message: 'Channel not found' })
    return
  }

  const { start, end } = currentMonthRange()
  const startStr = formatDate(start)
  const endStr = formatDate(end)

  try {
    const [followers, postsCounts, recentPosts] = await Promise.all([
      socialbu.getAccountsMetrics(channel.socialBuId, startStr, endStr, 'followers'),
      socialbu.getPostsCounts(channel.socialBuId, startStr, endStr),
      prisma.autopostingPost.findMany({
        where: { channelId, status: 'published' },
        orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: { id: true, caption: true, imageUrl: true, postedAt: true, socialBuId: true },
      }),
    ])

    const paddedFollowers = followers.map((account) => {
      const metrics = (account.metrics as { followers?: { date: string; value: number }[] } | undefined) ?? {}
      return {
        ...account,
        metrics: { ...metrics, followers: padDailySeries(metrics.followers ?? [], start, end) },
      }
    })

    res.json({ data: paddedFollowers, postsCounts, recentPosts })
  } catch (err) {
    logger.error('SocialBu analytics fetch failed:', err)
    res.status(502).json({ message: 'Gagal mengambil data analitik dari SocialBu' })
  }
}

export async function getTiktokLeaderboard(req: Request, res: Response) {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  const startStr = (req.query.start as string) || formatDate(start)
  const endStr = (req.query.end as string) || formatDate(end)

  const channels = await prisma.channel.findMany({
    where: { type: 'tiktok', socialBuId: { not: null } },
    orderBy: { id: 'asc' },
  })

  if (channels.length === 0) {
    res.json({ data: [] })
    return
  }

  try {
    const socialBuIds = channels.map((c) => c.socialBuId as string)
    const metrics = await socialbu.getAccountsMetrics(socialBuIds, startStr, endStr, 'followers')

    const byAccountId = new Map(metrics.map((m) => [String(m.account_id), m]))

    const leaderboard = channels.map((ch) => {
      const entry = byAccountId.get(ch.socialBuId as string) as
        | { metrics?: { followers?: { date: string; value: number }[] } }
        | undefined
      const followers = entry?.metrics?.followers ?? []
      const latest = followers.length > 0 ? followers[followers.length - 1].value : 0
      const earliest = followers[0]?.value ?? 0
      return {
        channelId: ch.id,
        username: ch.username,
        profilePhotoPath: ch.profilePhotoPath,
        followers: latest,
        growth: latest - earliest,
      }
    })

    leaderboard.sort((a, b) => b.followers - a.followers)

    res.json({ data: leaderboard })
  } catch (err) {
    logger.error('SocialBu leaderboard fetch failed:', err)
    res.status(502).json({ message: 'Gagal mengambil data leaderboard dari SocialBu' })
  }
}
