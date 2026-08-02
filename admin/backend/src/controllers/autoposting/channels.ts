import { Request, Response } from 'express'
import db from '../../config/database'
import { logger } from '../../utils/logger'
const prisma = db
import * as socialbu from '../../services/socialbu'

export async function getChannels(req: Request, res: Response) {
  const userId = (req as { user?: { id: number } }).user?.id ?? 1

  // Sync with SocialBu
  try {
    const accounts = await socialbu.getAccounts()
    for (const acc of accounts) {
      const sbId = String(acc['id'] ?? '')
      const name = String(acc['name'] ?? '')
      const username = acc['username'] ? String(acc['username']) : name
      const profilePhotoPath = acc['image'] ? String(acc['image']) : undefined
      // SocialBu returns type as "tiktok.profile", "instagram.profile", etc.
      const type = acc['type'] ? String(acc['type']).split('.')[0].toLowerCase() : undefined

      const existing = await prisma.channel.findUnique({ where: { socialBuId: sbId } })
      if (existing) {
        await prisma.channel.update({
          where: { id: existing.id },
          data: {
            username,
            ...(profilePhotoPath ? { profilePhotoPath } : {}),
            ...(type ? { type } : {}),
          },
        })
      } else {
        await prisma.channel.create({
          data: {
            userId,
            username,
            socialBuId: sbId,
            ...(profilePhotoPath ? { profilePhotoPath } : {}),
            ...(type ? { type } : {}),
          },
        })
      }
    }
  } catch (err) {
    logger.error('SocialBu sync failed:', err)
  }

  const channels = await prisma.channel.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
  })

  res.json({ data: channels })
}

export async function deleteChannel(req: Request, res: Response) {
  const id = parseInt(req.params.id)
  await prisma.channel.delete({ where: { id } })
  res.json({ message: 'Channel deleted' })
}
