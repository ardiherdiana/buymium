import cron from 'node-cron'
import { db } from '../config/database'
import { AccountsService } from './management/accountsService'
import { AccsmarketsService } from './management/accsmarketsService'
import { enqueueRapidApiCall } from '../utils/rapidApiQueue'
import { logger } from '../utils/logger'

async function runMidnightSync() {
  logger.info('[MidnightSync] Starting automatic sync + scan followers...')

  // 1. Sync accounts dari semua sources
  try {
    const sources = await db.source.findMany({ where: { spreadsheetId: { not: null } } })
    for (const source of sources) {
      try {
        await AccountsService.sync(String(source.id))
        logger.info(`[MidnightSync] Synced source: ${source.name}`)
      } catch (err) {
        logger.error(`[MidnightSync] Failed sync source ${source.name}: ${err}`)
      }
    }
  } catch (err) {
    logger.error(`[MidnightSync] Failed to load sources: ${err}`)
  }

  // 2. Sync accsmarkets dari semua sources yang bertipe accsmarket
  try {
    const accsmarketSources = await db.source.findMany({ where: { isAccsmarket: true, spreadsheetId: { not: null } } })
    for (const source of accsmarketSources) {
      try {
        await AccsmarketsService.sync(source.id)
        logger.info(`[MidnightSync] Synced accsmarket source: ${source.name}`)
      } catch (err) {
        logger.error(`[MidnightSync] Failed sync accsmarket source ${source.name}: ${err}`)
      }
    }
  } catch (err) {
    logger.error(`[MidnightSync] Failed to load accsmarket sources: ${err}`)
  }

  // 3. Scan followers semua accounts (tidak terjual, punya username)
  try {
    const accounts = await db.account.findMany({
      where: { isSold: false, username: { not: null } },
      select: { id: true, username: true },
    })
    logger.info(`[MidnightSync] Scanning ${accounts.length} accounts...`)
    for (const account of accounts) {
      try {
        await AccountsService.refreshFollowers(account.id)
      } catch (err) {
        logger.error(`[MidnightSync] Failed scan account ${account.username}: ${err}`)
      }
    }
    logger.info('[MidnightSync] Accounts scan done')
  } catch (err) {
    logger.error(`[MidnightSync] Failed to load accounts: ${err}`)
  }

  // 4. Scan followers semua accsmarkets
  try {
    const accsmarkets = await db.accsmarket.findMany({
      where: { isSold: false, username: { not: null } },
      select: { id: true, username: true },
    })
    logger.info(`[MidnightSync] Scanning ${accsmarkets.length} accsmarkets...`)
    for (const acc of accsmarkets) {
      try {
        await AccsmarketsService.refreshFollowers(acc.id)
      } catch (err) {
        logger.error(`[MidnightSync] Failed scan accsmarket ${acc.username}: ${err}`)
      }
    }
    logger.info('[MidnightSync] Accsmarkets scan done')
  } catch (err) {
    logger.error(`[MidnightSync] Failed to load accsmarkets: ${err}`)
  }

  logger.info('[MidnightSync] All done.')
}

export function startScheduler() {
  cron.schedule('0 0 * * *', () => {
    runMidnightSync().catch(err => logger.error(`[MidnightSync] Unhandled error: ${err}`))
  }, { timezone: 'Asia/Jakarta' })

  console.log('[Scheduler] Midnight WIB auto sync+scan scheduled (00:00 Asia/Jakarta)')

  cron.schedule('*/60 * * * * *', async () => {
    try {
      const now = new Date()

      const scheduledPosts = await db.autopostingPost.findMany({
        where: {
          status: 'scheduled',
          scheduledTime: {
            lte: now
          }
        }
      })

      if (scheduledPosts.length > 0) {
        for (const post of scheduledPosts) {
          await db.autopostingPost.update({
            where: { id: post.id },
            data: {
              status: 'published',
              postedAt: post.scheduledTime ?? now,
            },
          })
        }

        console.log(`[Scheduler] Updated ${scheduledPosts.length} posts from scheduled to published`)
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err)
    }
  })

  console.log('[Scheduler] Started - runs every 60 seconds')
}
