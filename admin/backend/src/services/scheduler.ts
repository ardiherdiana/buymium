import cron from 'node-cron'
import { db } from '../config/database'
import { logger } from '../utils/logger'
import { AccountsService } from './management/accountsService'
import { AccsmarketsService } from './management/accsmarketsService'
import { UpfollService } from './management/upfollService'

export function startScheduler() {
  cron.schedule('*/60 * * * * *', async () => {
    await expireStaleOrders()
  })

  console.log('[Scheduler] Order expiry job started - runs every 60 seconds')

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

// Orders left unpaid for more than 24h are auto-cancelled and their reserved
// Account/Accsmarket rows released back to available stock - mirrors the manual
// reject flow in ecommerce/orders.ts so this stays authoritative regardless of
// whether the admin or user frontend happens to be the one loading the order.
async function expireStaleOrders() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const staleOrders = await db.order.findMany({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      select: { id: true },
    })
    if (staleOrders.length === 0) return

    const ids = staleOrders.map(o => o.id)
    await db.account.updateMany({ where: { reservedOrderId: { in: ids } }, data: { reservedOrderId: null } })
    await db.accsmarket.updateMany({ where: { reservedOrderId: { in: ids } }, data: { reservedOrderId: null } })
    await db.order.updateMany({ where: { id: { in: ids } }, data: { status: 'cancelled' } })

    console.log(`[Scheduler] Auto-cancelled ${ids.length} stale pending order(s) past 24h`)
  } catch (err) {
    logger.error('[Scheduler] Order expiry job failed:', err)
  }
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

async function scanUpfoll() {
  const { items } = await UpfollService.getItemsForScan()
  for (const item of items) {
    try {
      await UpfollService.refreshFollowers(item.id)
    } catch (err) {
      logger.error(`[Scheduler] Error scanning upfoll item #${item.id}:`, err)
    }
  }
  console.log(`[Scheduler] Upfoll scan done - ${items.length} item(s) processed`)
}

async function runMidnightSyncAndScan() {
  console.log('[Scheduler] Midnight sync & scan started')
  try {
    await syncAccounts()
    await scanAccounts()
    await syncAccsmarkets()
    await scanAccsmarkets()
    await scanUpfoll()
    console.log('[Scheduler] Midnight sync & scan finished')
  } catch (err) {
    logger.error('[Scheduler] Midnight sync & scan failed:', err)
  }
}
