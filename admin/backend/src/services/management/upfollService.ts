import db from '../../config/database'
import { getHttpClient } from './googleSheets/client'
import { logger } from '../../utils/logger'
import { enqueueRapidApiCall } from '../../utils/rapidApiQueue'

const prisma = db

export const UpfollService = {
  // Raw Instagram follower-count lookup, shared by baseline capture (order creation)
  // and the regular scan/refresh flow.
  async fetchFollowerCount(rawUsername: string): Promise<number> {
    const rapidApiKey = process.env.RAPID_API_KEY
    if (!rapidApiKey) {
      throw new Error('RapidAPI key belum dikonfigurasi')
    }

    const username = rawUsername.replace('@', '').trim()
    if (!username) {
      throw new Error('Username tidak valid')
    }

    logger.info(`Mengambil jumlah followers untuk username upfoll: ${username}`)

    const httpClient = await getHttpClient()
    const response = await enqueueRapidApiCall(() =>
      httpClient.get('https://instagram-looter2.p.rapidapi.com/profile2', {
        params: { username },
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'instagram-looter2.p.rapidapi.com',
        },
      })
    )

    const data = response.data

    if (data.status === false) {
      const errorMessage = data.errorMessage || data.message || 'Akun tidak ditemukan di Instagram'
      logger.warn(`Akun Instagram tidak ditemukan untuk username upfoll ${username}: ${errorMessage}`)
      throw new Error(`Akun Instagram '${username}' tidak ditemukan. ${errorMessage}`)
    }

    // 0 is a valid follower count — only missing/null means the API didn't return one
    if (data.follower_count === undefined || data.follower_count === null) {
      throw new Error(data.errorMessage || 'Jumlah followers tidak ditemukan dalam response API')
    }

    return parseInt(String(data.follower_count))
  },

  async refreshFollowers(itemId: number) {
    const item = await prisma.upfollItem.findUnique({
      where: { id: itemId },
      include: { vendorTier: true },
    })

    if (!item) {
      throw new Error('Item upfoll tidak ditemukan')
    }

    const followerCount = await this.fetchFollowerCount(item.username)

    // Progress/completion is judged against the baseline captured at order time
    // plus the package's follower target — not the flat package target — so a
    // "5.000 followers" order on an account that already had 2.400 followers
    // actually needs to reach 7.400, not just 5.000.
    const baseline = item.startingFollowers ?? 0
    const actualTarget = baseline + item.vendorTier.targetFollowers
    const status = followerCount >= actualTarget ? 'selesai' : 'progress'

    await prisma.upfollItem.update({
      where: { id: item.id },
      data: { currentFollowers: followerCount, status },
    })

    logger.info(`Jumlah followers item upfoll ID ${item.id} (${item.username}) diperbarui: ${followerCount}/${actualTarget}`)

    return { success: true, follower_count: followerCount, status }
  },

  async getItemsForScan() {
    const items = await prisma.upfollItem.findMany({
      where: { status: 'progress' },
      select: { id: true, username: true, currentFollowers: true, orderId: true, vendorTier: { select: { id: true, name: true, targetFollowers: true } } },
      orderBy: { id: 'asc' },
    })

    return { success: true, items, total: items.length }
  },

  async scanAll() {
    const { items } = await this.getItemsForScan()
    for (const item of items) {
      try {
        await this.refreshFollowers(item.id)
      } catch (error) {
        logger.error(`Gagal scan item upfoll ID ${item.id}:`, error)
      }
    }
  },
}
