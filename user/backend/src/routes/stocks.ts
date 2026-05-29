import { Router, Request, Response } from 'express'
import db from '../config/database'
import { requireAdmin } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { StockBulkSchema } from '../validators'

const router = Router()

router.get('/product/:productId', requireAdmin, async (req: Request, res: Response) => {
  const { productId } = req.params
  const stocks = await db.stock.findMany({
    where: { productId: Number(productId) },
    orderBy: { createdAt: 'desc' },
  })
  res.json(stocks)
})

interface StockBulkItem {
  email?: string
  password_email?: string
  username: string
  password: string
  two_factor_code?: string
}

router.post('/bulk', requireAdmin, validate(StockBulkSchema), async (req: Request, res: Response) => {
  const { productId, data } = req.body as { productId: number; data: StockBulkItem[] }


  try {
    const createdStocks = await db.$transaction(
      data.map((item) =>
        db.stock.create({
          data: {
            productId,
            email: item.email || null,
            passwordEmail: item.password_email || null,
            username: item.username,
            password: item.password,
            twoFactorCode: item.two_factor_code || null,
            status: 'available',
          },
        })
      )
    )

    const totalAvailable = await db.stock.count({
      where: { productId, status: 'available' },
    })

    await db.product.update({
      where: { id: productId },
      data: { inStock: totalAvailable },
    })

    res.status(201).json({ message: `${createdStocks.length} stok berhasil diunggah`, count: createdStocks.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Kesalahan tidak diketahui'
    console.error('[Stocks Bulk]', msg)
    res.status(500).json({ error: 'Gagal mengunggah stok', detail: msg })
  }
})

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const stock = await db.stock.delete({ where: { id: Number(id) } })
    
    const totalAvailable = await db.stock.count({
      where: { productId: stock.productId, status: 'available' },
    })
    await db.product.update({
      where: { id: stock.productId },
      data: { inStock: totalAvailable },
    })

    res.json({ message: 'Stok berhasil dihapus' })
  } catch {
    res.status(404).json({ error: 'Stok tidak ditemukan' })
  }
})

export default router
