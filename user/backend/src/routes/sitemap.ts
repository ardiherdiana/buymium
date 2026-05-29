import { Router } from 'express'
import { db } from '../config/database'

const router = Router()

const STATIC_PATHS = ['/', '/faq', '/support', '/terms', '/privacy', '/refund', '/services/followers']

router.get('/', async (_req, res) => {
  try {
    const siteUrl = process.env.SITE_URL || 'https://buymium.id'

    const products = await db.product.findMany({
      where: { inStock: { gt: 0 } },
      select: { id: true, updatedAt: true },
    })

    const now = new Date().toISOString()
    const entries = [
      ...STATIC_PATHS.map((p) => ({
        loc: `${siteUrl}${p}`,
        lastmod: now,
        changefreq: p === '/' ? 'daily' : 'monthly',
        priority: p === '/' ? '1.0' : '0.7',
      })),
      ...products.map((p) => ({
        loc: `${siteUrl}/item/${p.id}`,
        lastmod: p.updatedAt.toISOString(),
        changefreq: 'daily',
        priority: '0.9',
      })),
    ]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>`

    res.type('application/xml').send(xml)
  } catch (err) {
    console.error('sitemap error', err)
    res.status(500).type('text/plain').send('sitemap error')
  }
})

export default router
