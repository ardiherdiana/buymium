import { Request, Response } from 'express'
import db from '../../config/database'
import { logger } from '../../utils/logger'
const prisma = db
import * as socialbu from '../../services/socialbu'
import path from 'path'
import fs from 'fs'

function buildPlatformOptions(channelType: string | null | undefined): Record<string, unknown> | undefined {
  const type = (channelType ?? '').toLowerCase()
  if (type === 'tiktok') {
    return {
      privacy_status: 'PUBLIC_TO_EVERYONE',
      allow_comment: true,
      allow_stitch: true,
      allow_duet: true,
    }
  }
  return undefined
}

export async function getPosts(req: Request, res: Response) {
  const userId = (req as { user?: { id: number } }).user?.id ?? 1
  const channelId = req.query.channel_id ? parseInt(req.query.channel_id as string) : undefined
  const status = req.query.status as string | undefined
  const sortField = req.query.sort as string | undefined
  const sortOrder = (req.query.order as string | undefined) === 'asc' ? 'asc' : 'desc'
  const startDateStr = req.query.start_date as string | undefined
  const endDateStr = req.query.end_date as string | undefined
  const page = Math.max(1, parseInt((req.query.page as string) || '1'))
  const limit = Math.max(1, parseInt((req.query.limit as string) || '10'))
  const offset = (page - 1) * limit

  const where: Record<string, unknown> = { userId }
  if (channelId) where.channelId = channelId
  if (status) where.status = status

  // Date range filter — field depends on status (same logic as Go)
  if (startDateStr || endDateStr) {
    const dateField =
      status === 'scheduled' ? 'scheduledTime' :
      status === 'published' ? 'postedAt' :
      'createdAt'
    const range: Record<string, Date> = {}
    if (startDateStr) range.gte = new Date(startDateStr)
    if (endDateStr) range.lte = new Date(endDateStr)
    where[dateField] = range
  }

  // Sort order — custom if provided, else default by status
  let orderBy: Record<string, string>
  if (sortField) {
    orderBy = { [sortField]: sortOrder }
  } else if (status === 'scheduled') {
    orderBy = { scheduledTime: 'asc' }
  } else if (status === 'published') {
    orderBy = { postedAt: 'desc' }
  } else {
    orderBy = { createdAt: 'desc' }
  }

  const hasDateRange = !!(startDateStr || endDateStr)

  const [total, posts] = await Promise.all([
    prisma.autopostingPost.count({ where }),
    prisma.autopostingPost.findMany({
      where,
      orderBy,
      // If date range provided, return all (no pagination) — same as Go
      ...(hasDateRange ? {} : { skip: offset, take: limit }),
    }),
  ])

  const last_page = Math.max(1, Math.ceil(total / limit))

  res.json({ data: posts, total, page, limit, last_page })
}

export async function createPost(req: Request, res: Response) {
  const userId = (req as { user?: { id: number } }).user?.id ?? 1
  const caption = req.body.caption as string ?? ''
  const source = req.body.source as string ?? ''
  const status = (req.body.status as string) || 'drafted'
  const scheduledTimeStr = req.body.scheduledTime as string | undefined
  // FE sends channelIds (plural, single value)
  const channelIdRaw = req.body.channelIds ?? req.body.channel_id
  const channelId = channelIdRaw ? parseInt(String(channelIdRaw)) : 0

  if (!channelId) {
    res.status(400).json({ error: 'channelIds is required' })
    return
  }

  let scheduledTime: Date | undefined
  if (scheduledTimeStr) {
    scheduledTime = new Date(scheduledTimeStr)
    if (isNaN(scheduledTime.getTime())) {
      res.status(400).json({ error: 'Invalid scheduledTime format' })
      return
    }
  }

  // Handle uploaded file
  let imageUrl: string | undefined
  let uploadToken: string | undefined

  const file = (req as { file?: Express.Multer.File }).file
  if (file) {
    imageUrl = `/uploads/${file.filename}`

    if (status === 'scheduled' || status === 'published') {
      const result = await socialbu.uploadMedia(file.path)
      uploadToken = result.uploadToken
    }
  }

  let sbPostId = ''
  if ((status === 'scheduled' || status === 'published') && channelId) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel?.socialBuId) {
      res.status(400).json({ error: 'Invalid channel or missing SocialBu ID' })
      return
    }
    const sbAccountId = parseInt(channel.socialBuId)
    const publishAt = scheduledTime
      ? scheduledTime.toISOString().replace('T', ' ').slice(0, 19)
      : new Date().toISOString().replace('T', ' ').slice(0, 19)

    const finalCaption = source ? `${caption}\n\nSource : ${source}` : caption
    const platformOptions = buildPlatformOptions(channel.type)
    sbPostId = await socialbu.createPost(finalCaption, [sbAccountId], uploadToken ? [uploadToken] : [], publishAt, platformOptions)
  }

  const post = await prisma.autopostingPost.create({
    data: {
      userId,
      channelId,
      caption,
      source: source || null,
      imageUrl: imageUrl ?? null,
      scheduledTime: scheduledTime ?? null,
      status,
      socialBuId: sbPostId || null,
      ...(status === 'published' ? { postedAt: new Date() } : {}),
    },
  })

  res.json({ data: post })
}

export async function updatePost(req: Request, res: Response) {
  const userId = (req as { user?: { id: number } }).user?.id ?? 1
  const id = parseInt(req.params.id)

  const post = await prisma.autopostingPost.findFirst({ where: { id, userId } })
  if (!post) {
    res.status(404).json({ error: 'Post not found' })
    return
  }

  const updates: Record<string, unknown> = {}

  const file = (req as { file?: Express.Multer.File }).file
  if (file) {
    // Delete old file from disk
    if (post.imageUrl) {
      const oldPath = path.join(process.cwd(), post.imageUrl)
      try { fs.unlinkSync(oldPath) } catch {}
    }
    updates.imageUrl = `/uploads/${file.filename}`
  }

  if (req.body.caption !== undefined) updates.caption = req.body.caption
  if (req.body.source !== undefined) updates.source = req.body.source || null
  if (req.body.status !== undefined) updates.status = req.body.status
  if (req.body.channelId !== undefined) updates.channelId = parseInt(req.body.channelId)

  if (req.body.scheduledTime !== undefined) {
    const parsed = new Date(req.body.scheduledTime)
    if (isNaN(parsed.getTime())) {
      res.status(400).json({ error: 'Invalid scheduledTime format' })
      return
    }
    updates.scheduledTime = parsed
  }

  const newStatus = (updates.status as string) ?? post.status

  // If status moves to scheduled/published and no SocialBu ID yet, create on SocialBu
  if ((newStatus === 'scheduled' || newStatus === 'published') && !post.socialBuId) {
    const channelId = (updates.channelId as number | undefined) ?? post.channelId
    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (channel?.socialBuId) {
      const sbAccountId = parseInt(channel.socialBuId)
      const scheduledTime = (updates.scheduledTime as Date | undefined) ?? post.scheduledTime
      const publishAt = scheduledTime
        ? scheduledTime.toISOString().replace('T', ' ').slice(0, 19)
        : new Date().toISOString().replace('T', ' ').slice(0, 19)
      const caption = (updates.caption as string | undefined) ?? post.caption
      const source = (updates.source as string | undefined) ?? post.source
      const finalCaption = source ? `${caption}\n\nSource : ${source}` : caption

      let uploadToken: string | undefined
      if (file) {
        const result = await socialbu.uploadMedia(file.path)
        uploadToken = result.uploadToken
      }

      const platformOptions = buildPlatformOptions(channel.type)
      const sbPostId = await socialbu.createPost(finalCaption, [sbAccountId], uploadToken ? [uploadToken] : [], publishAt, platformOptions)
      if (sbPostId) updates.socialBuId = sbPostId
    }
  }

  if (newStatus === 'published' && post.status !== 'published') {
    updates.postedAt = new Date()
  }

  const updated = await prisma.autopostingPost.update({ where: { id }, data: updates })
  res.json({ data: updated })
}

export async function deletePost(req: Request, res: Response) {
  const userId = (req as { user?: { id: number } }).user?.id ?? 1
  const id = parseInt(req.params.id)

  const post = await prisma.autopostingPost.findFirst({ where: { id, userId } })
  if (!post) {
    res.status(404).json({ error: 'Post not found' })
    return
  }

  if (post.socialBuId) {
    try { await socialbu.deletePost(post.socialBuId) } catch (e) { logger.error('SocialBu delete failed:', e) }
  }

  if (post.imageUrl) {
    const filePath = path.join(process.cwd(), post.imageUrl)
    try { fs.unlinkSync(filePath) } catch {}
  }

  await prisma.autopostingPost.delete({ where: { id } })
  res.json({ message: 'Post deleted successfully' })
}

export async function deleteAllPosts(req: Request, res: Response) {
  const userId = (req as { user?: { id: number } }).user?.id ?? 1
  const channelId = req.query.channel_id ? parseInt(req.query.channel_id as string) : undefined

  const where: Record<string, unknown> = { userId }
  if (channelId) where.channelId = channelId

  const posts = await prisma.autopostingPost.findMany({ where })

  for (const post of posts) {
    if (post.socialBuId) {
      try { await socialbu.deletePost(post.socialBuId) } catch {}
    }
    if (post.imageUrl) {
      const filePath = path.join(process.cwd(), post.imageUrl)
      try { fs.unlinkSync(filePath) } catch {}
    }
  }

  await prisma.autopostingPost.deleteMany({ where })
  res.json({ message: 'All posts deleted successfully' })
}
