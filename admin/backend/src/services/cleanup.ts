import cron from 'node-cron'
import { db } from '../config/database'
import fs from 'fs'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'autoposting')

export function startCleanup() {
  cron.schedule('0 0 * * *', async () => {
    try {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      const oldPosts = await db.autopostingPost.findMany({
        where: {
          status: 'published',
          postedAt: {
            lte: threeMonthsAgo
          }
        }
      })

      for (const post of oldPosts) {
        if (post.imageUrl) {
          const filename = path.basename(post.imageUrl)
          const filepath = path.join(UPLOADS_DIR, filename)

          try {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath)
              console.log(`[Cleanup] Deleted: ${filename}`)
            }
          } catch (err) {
            console.error(`[Cleanup] Failed to delete ${filename}:`, err)
          }
        }
      }

      if (oldPosts.length > 0) {
        console.log(`[Cleanup] Processed ${oldPosts.length} old posts`)
      }
    } catch (err) {
      console.error('[Cleanup] Error:', err)
    }
  })

  console.log('[Cleanup] Started - runs daily at 00:00')
}
