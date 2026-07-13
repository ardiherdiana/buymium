import cron from 'node-cron'
import { db } from '../config/database'
import { logger } from '../utils/logger'
import { AccountsService } from './management/accountsService'
import { AccsmarketsService } from './management/accsmarketsService'

export function startScheduler() {
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

  cron.schedule('0 0 * * *', async () => {
    await runMidnightSyncAndScan()
  })

  console.log('[Scheduler] Midnight sync & scan job scheduled - runs daily at 00:00')
}

async function syncAccounts() {
  const sources = await db.source.findMany({ where: { isAccsmarket: false } })
  let syncedCount = 0
  for (const source of sources) {
    try {
      const result = await AccountsService.sync(source.id.toString())
      syncedCount += result.syncedCount
    } catch (err) {
      logger.error(`[Scheduler] Error syncing accounts source '${source.name}':`, err)
    }
  }
  console.log(`[Scheduler] Accounts sync done - ${syncedCount} synced across ${sources.length} source(s)`)
}

async function scanAccounts() {
  const { accounts } = await AccountsService.getAccountsForScan()
  for (const account of accounts) {
    try {
      await AccountsService.refreshFollowers(account.id)
    } catch (err) {
      logger.error(`[Scheduler] Error scanning account #${account.id}:`, err)
    }
  }
  console.log(`[Scheduler] Accounts scan done - ${accounts.length} account(s) processed`)
}

async function syncAccsmarkets() {
  const sources = await db.source.findMany({ where: { isAccsmarket: true } })
  let syncedCount = 0
  for (const source of sources) {
    try {
      const result = await AccsmarketsService.sync(source.id)
      syncedCount += result.syncedCount
    } catch (err) {
      logger.error(`[Scheduler] Error syncing accsmarket source '${source.name}':`, err)
    }
  }
  console.log(`[Scheduler] Accsmarket sync done - ${syncedCount} synced across ${sources.length} source(s)`)
}

async function scanAccsmarkets() {
  const { accsmarkets } = await AccsmarketsService.getAccountsForScan()
  for (const accsmarket of accsmarkets) {
    try {
      await AccsmarketsService.refreshFollowers(accsmarket.id)
    } catch (err) {
      logger.error(`[Scheduler] Error scanning accsmarket #${accsmarket.id}:`, err)
    }
  }
  console.log(`[Scheduler] Accsmarket scan done - ${accsmarkets.length} account(s) processed`)
}

async function runMidnightSyncAndScan() {
  console.log('[Scheduler] Midnight sync & scan started')
  try {
    await syncAccounts()
    await scanAccounts()
    await syncAccsmarkets()
    await scanAccsmarkets()
    console.log('[Scheduler] Midnight sync & scan finished')
  } catch (err) {
    logger.error('[Scheduler] Midnight sync & scan failed:', err)
  }
}
