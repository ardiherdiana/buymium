import cron from 'node-cron'
import { db } from '../config/database'

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
}
