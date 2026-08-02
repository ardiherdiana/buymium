import { Request, Response } from 'express'
import db from '../../config/database'
const prisma = db

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_SLOTS = ['09:00 AM', '05:00 PM']

function parseSlots(raw: string): string[] {
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function getSchedules(req: Request, res: Response) {
  const userId = (req as { user?: { id: number } }).user?.id ?? 1
  const channelId = parseInt(req.query.channel_id as string)

  if (!channelId) {
    res.status(400).json({ error: 'channel_id is required' })
    return
  }

  let schedules = await prisma.autopostingSchedule.findMany({
    where: { userId, channelId },
    orderBy: { id: 'asc' },
  })

  // Auto-create defaults if none exist
  if (schedules.length === 0) {
    const defaultData: { userId: number; channelId: number; day: string; isActive: boolean; slots: string }[] = DAYS.map((day) => ({
      userId,
      channelId,
      day,
      isActive: true,
      slots: JSON.stringify(DEFAULT_SLOTS),
    }))
    await prisma.autopostingSchedule.createMany({ data: defaultData })
    schedules = await prisma.autopostingSchedule.findMany({
      where: { userId, channelId },
      orderBy: { id: 'asc' },
    })
  }

  const result = schedules.map((s) => ({
    id: s.id,
    day: s.day,
    isActive: s.isActive,
    slots: parseSlots(s.slots),
    channelId: s.channelId,
  }))

  res.json({ data: result })
}

export async function updateSchedules(req: Request, res: Response) {
  const userId = (req as { user?: { id: number } }).user?.id ?? 1
  const { schedules } = req.body as {
    schedules: { id: number; isActive: boolean; slots: string[] }[]
  }

  if (!Array.isArray(schedules)) {
    res.status(400).json({ error: 'schedules must be an array' })
    return
  }

  for (const s of schedules) {
    await prisma.autopostingSchedule.updateMany({
      where: { id: s.id, userId },
      data: {
        isActive: s.isActive,
        slots: JSON.stringify(s.slots),
      },
    })
  }

  res.json({ message: 'Schedule updated successfully' })
}
