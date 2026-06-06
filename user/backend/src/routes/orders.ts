import { Router, Request, Response } from 'express'
import PDFDocument = require('pdfkit')
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import db from '../config/database'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { CreateOrderSchema, CartOrderSchema } from '../validators'
import { safeDecrypt } from '../utils/encrypt'
import { userRateLimit } from '../middleware/userRateLimit'
import { sendOrderCreated, sendProofUploaded } from '../utils/email'

const router = Router()

const SERVICE_FEE = 2000

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'payment-proofs')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('File harus berupa gambar JPG/PNG/WEBP'))
  },
})

function generateGroupId(prefix: string, userId: number): string {
  return `BUYMIUM-${prefix}-${userId}-${Date.now()}`
}

async function reserveStocks(orderId: number, productId: number, stockIds?: number[]): Promise<void> {
  if (!stockIds?.length) return
  const valid = await db.stock.findMany({
    where: { id: { in: stockIds }, productId, status: 'available' },
  })
  if (valid.length === 0) return
  await db.stock.updateMany({
    where: { id: { in: valid.map(s => s.id) } },
    data: { status: 'reserved', orderId },
  })
}

router.post('/', requireAuth, userRateLimit, validate(CreateOrderSchema), async (req: Request, res: Response) => {
  const { userId } = req.user!
  const { productId, quantity = 1, stockIds } = req.body as { productId: number; quantity: number; stockIds?: number[] }

  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return }
  if (product.inStock < quantity) { res.status(400).json({ error: 'Stok tidak mencukupi' }); return }

  const subtotal = Math.round(product.price * quantity)
  const totalPrice = subtotal + SERVICE_FEE
  const groupId = generateGroupId('SO', userId)

  const order = await db.order.create({
    data: { userId, productId, quantity, totalPrice, status: 'pending', groupId },
  })

  await reserveStocks(order.id, productId, stockIds)

  const user = await db.user.findUnique({ where: { id: userId } })
  if (user?.email) {
    sendOrderCreated({ to: user.email, name: user.name || 'Pelanggan', groupId, totalPrice, itemCount: quantity }).catch(() => {})
  }

  res.status(201).json({ orderId: order.id, groupId })
})

router.post('/cart', requireAuth, userRateLimit, validate(CartOrderSchema), async (req: Request, res: Response) => {
  const { userId } = req.user!
  const { items } = req.body as { items: { productId: number; quantity: number; stockIds?: number[] }[] }

  const products = await Promise.all(items.map(it => db.product.findUnique({ where: { id: it.productId } })))
  for (let i = 0; i < items.length; i++) {
    if (!products[i]) { res.status(404).json({ error: `Produk ${items[i].productId} tidak ditemukan` }); return }
    if (products[i]!.inStock < items[i].quantity) {
      res.status(400).json({ error: `Stok "${products[i]!.title.slice(0, 30)}" tidak mencukupi` }); return
    }
  }

  const groupId = generateGroupId('CART', userId)

  const orders = await Promise.all(
    items.map((it, i) => {
      const subtotal = Math.round(products[i]!.price * it.quantity)
      const totalPrice = subtotal + (i === 0 ? SERVICE_FEE : 0)
      return db.order.create({
        data: { userId, productId: it.productId, quantity: it.quantity, totalPrice, status: 'pending', groupId },
      })
    })
  )

  await Promise.all(items.map((it, i) => reserveStocks(orders[i].id, it.productId, it.stockIds)))

  const totalAll = orders.reduce((s, o) => s + o.totalPrice, 0)
  const totalQty = items.reduce((s, it) => s + it.quantity, 0)
  const user = await db.user.findUnique({ where: { id: userId } })
  if (user?.email) {
    sendOrderCreated({ to: user.email, name: user.name || 'Pelanggan', groupId, totalPrice: totalAll, itemCount: totalQty }).catch(() => {})
  }

  res.status(201).json({ orderIds: orders.map(o => o.id), firstOrderId: orders[0].id, groupId })
})

router.post('/:id/proof', requireAuth, userRateLimit, upload.single('proof'), async (req: Request, res: Response) => {
  const { userId } = req.user!
  const orderId = parseInt(req.params.id as string, 10)
  const { bankAccountId } = req.body as { bankAccountId?: string }

  if (!req.file) { res.status(400).json({ error: 'File bukti transfer wajib diupload' }); return }
  if (isNaN(orderId)) { res.status(400).json({ error: 'ID pesanan tidak valid' }); return }

  const order = await db.order.findFirst({ where: { id: orderId, userId } })
  if (!order) {
    fs.unlink(req.file.path, () => {})
    res.status(404).json({ error: 'Pesanan tidak ditemukan' }); return
  }
  if (order.status !== 'pending' && order.status !== 'awaiting_confirmation') {
    fs.unlink(req.file.path, () => {})
    res.status(400).json({ error: 'Pesanan ini tidak bisa di-update' }); return
  }

  const bankId = bankAccountId ? Number(bankAccountId) : null
  if (bankId) {
    const bank = await db.bankAccount.findFirst({ where: { id: bankId, isActive: true } })
    if (!bank) {
      fs.unlink(req.file.path, () => {})
      res.status(400).json({ error: 'Rekening tidak valid' }); return
    }
  }

  if (order.paymentProof) {
    const oldPath = path.join(process.cwd(), order.paymentProof)
    fs.unlink(oldPath, () => {})
  }

  const relativePath = path.join('uploads', 'payment-proofs', req.file.filename).replace(/\\/g, '/')

  const updateData: { paymentProof: string; proofUploadedAt: Date; status: string; bankAccountId?: number | null } = {
    paymentProof: relativePath,
    proofUploadedAt: new Date(),
    status: 'awaiting_confirmation',
  }
  if (bankId) updateData.bankAccountId = bankId

  if (order.groupId) {
    await db.order.updateMany({ where: { groupId: order.groupId, userId }, data: updateData })
  } else {
    await db.order.update({ where: { id: order.id }, data: updateData })
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (user?.email) {
    const groupTotal = order.groupId
      ? (await db.order.aggregate({ where: { groupId: order.groupId, userId }, _sum: { totalPrice: true } }))._sum.totalPrice ?? order.totalPrice
      : order.totalPrice
    sendProofUploaded({ to: user.email, name: user.name || 'Pelanggan', groupId: order.groupId || `#${order.id}`, totalPrice: groupTotal }).catch(() => {})
  }

  res.json({ message: 'Bukti transfer berhasil diupload, menunggu konfirmasi admin' })
})

router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!
  const [totalOrders, pendingOrders, completedOrders] = await Promise.all([
    db.order.count({ where: { userId } }),
    db.order.count({ where: { userId, status: { in: ['pending', 'waiting_confirmation'] } } }),
    db.order.count({ where: { userId, status: 'completed' } }),
  ])
  res.json({ totalOrders, pendingOrders, completedOrders })
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!

  const expiryCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const expiredOrders = await db.order.findMany({
    where: { userId, status: 'pending', createdAt: { lt: expiryCutoff } },
    select: { id: true },
  })
  if (expiredOrders.length > 0) {
    const ids = expiredOrders.map(o => o.id)
    await db.order.updateMany({ where: { id: { in: ids } }, data: { status: 'cancelled' } })
    await db.stock.updateMany({
      where: { orderId: { in: ids }, status: 'reserved' },
      data: { status: 'available', orderId: null },
    })
  }

  const orders = await db.order.findMany({
    where: { userId },
    include: {
      product: { select: { id: true, title: true, price: true, section: { select: { title: true } } } },
      bankAccount: { select: { id: true, bankName: true, accountHolder: true, accountNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  res.json(orders)
})

router.post('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!
  const orderId = parseInt(req.params.id as string, 10)
  if (isNaN(orderId)) { res.status(400).json({ error: 'ID pesanan tidak valid' }); return }

  const order = await db.order.findFirst({ where: { id: orderId, userId } })
  if (!order) { res.status(404).json({ error: 'Pesanan tidak ditemukan' }); return }
  if (order.status !== 'pending') {
    res.status(400).json({ error: 'Hanya pesanan dengan status menunggu pembayaran yang bisa dibatalkan' })
    return
  }

  await db.order.update({ where: { id: orderId }, data: { status: 'cancelled' } })
  await db.stock.updateMany({
    where: { orderId, status: 'reserved' },
    data: { status: 'available', orderId: null },
  })

  res.json({ message: 'Pesanan berhasil dibatalkan' })
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!
  const orderId = parseInt(req.params.id as string, 10)
  if (isNaN(orderId)) { res.status(400).json({ error: 'ID pesanan tidak valid' }); return }

  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: {
      product: { include: { section: true } },
      bankAccount: { select: { id: true, bankName: true, accountHolder: true, accountNumber: true, logo: true } },
    },
  })

  if (!order) { res.status(404).json({ error: 'Pesanan tidak ditemukan' }); return }

  let relatedOrders: unknown[] = []
  if (order.groupId?.startsWith('BUYMIUM-CART-')) {
    relatedOrders = await db.order.findMany({
      where: { groupId: order.groupId, userId },
      include: { product: { include: { section: true } } },
      orderBy: { id: 'asc' },
    })
  }

  res.json({ ...order, relatedOrders })
})

router.get('/:id/download', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!
  const orderId = parseInt(req.params.id as string, 10)
  if (isNaN(orderId)) { res.status(400).json({ error: 'ID pesanan tidak valid' }); return }

  const order = await db.order.findFirst({
    where: { id: orderId, userId, status: 'paid' },
    include: { stocks: true, product: true },
  })

  if (!order) { res.status(403).json({ error: 'Tidak diizinkan' }); return }
  if (!order.stocks.length) { res.status(404).json({ error: 'Gagal mengambil data akun. Silakan hubungi admin.' }); return }

  let textContent = `PESANAN: ${order.groupId ?? order.id}\n`
  textContent += `PRODUK: ${order.product.title}\n`
  textContent += `JUMLAH: ${order.quantity}\n`
  textContent += `TANGGAL: ${new Date(order.createdAt).toLocaleString('id-ID')}\n`
  textContent += `==========================================\n\n`

  order.stocks.forEach((stock, index) => {
    textContent += `AKUN #${index + 1}\n`
    textContent += `Email: ${stock.email || 'N/A'}\n`
    textContent += `Password Email: ${safeDecrypt(stock.passwordEmail) || 'N/A'}\n`
    textContent += `Username: ${stock.username || 'N/A'}\n`
    textContent += `Password: ${safeDecrypt(stock.password) || 'N/A'}\n`
    textContent += `2FA: ${safeDecrypt(stock.twoFactorCode) || 'N/A'}\n`
    textContent += `------------------------------------------\n`
  })

  const fileName = `${order.groupId ?? order.id}.txt`
  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.send(textContent)
})

router.get('/:id/invoice', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!
  const orderId = parseInt(req.params.id as string, 10)
  if (isNaN(orderId)) { res.status(400).json({ error: 'ID pesanan tidak valid' }); return }

  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: { product: { include: { section: true } }, user: true, bankAccount: true },
  })
  if (!order) { res.status(404).json({ error: 'Pesanan tidak ditemukan' }); return }

  let allOrders = [order] as typeof order[]
  if (order.groupId?.startsWith('BUYMIUM-CART-')) {
    const related = await db.order.findMany({
      where: { groupId: order.groupId, userId },
      include: { product: { include: { section: true } }, user: true, bankAccount: true },
      orderBy: { id: 'asc' },
    })
    if (related.length > 0) allOrders = related as typeof order[]
  }

  const grandSubtotal = allOrders.reduce((sum, o) => sum + Math.round(o.product.price * o.quantity), 0)
  const grandTotal = grandSubtotal + SERVICE_FEE

  try {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true, bufferPages: false })
    const fileName = `invoice-${order.groupId ?? order.id}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    doc.pipe(res)

    const W = doc.page.width
    const blue = '#1E3A5F'
    const gray = '#6B7280'
    const lightGray = '#F3F4F6'
    const statusColor = order.status === 'paid' ? '#16A34A' : order.status === 'cancelled' ? '#DC2626' : '#D97706'
    const statusLabel = order.status === 'paid' ? 'LUNAS'
      : order.status === 'awaiting_confirmation' ? 'MENUNGGU KONFIRMASI'
      : order.status === 'cancelled' ? 'DIBATALKAN'
      : 'MENUNGGU PEMBAYARAN'

    const label = (text: string, x: number, y: number, opts: Record<string, unknown> = {}) =>
      doc.fontSize(opts.size as number ?? 8)
        .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(opts.color as string ?? '#111827')
        .text(text, x, y, { lineBreak: false, ...opts })

    doc.rect(0, 0, W, 70).fill(blue)
    label('BUYMIUM', 50, 18, { bold: true, size: 20, color: 'white' })
    label('Invoice Pembayaran', 50, 46, { size: 9, color: 'white' })
    label(order.groupId ?? `#${order.id}`, 50, 56, { size: 8, color: '#93C5FD' })

    let y = 88
    doc.rect(0, 80, W, 16).fill('#F8FAFC')
    label('Detail Invoice', 50, y - 4, { bold: true, size: 9, color: blue })
    doc.moveTo(50, y + 10).lineTo(W - 50, y + 10).strokeColor('#E2E8F0').lineWidth(0.5).stroke()

    const ROW = 18
    y = 108

    const metaRow = (lbl: string, val: string, vy: number, isStatus = false) => {
      label(lbl, 50, vy, { color: gray })
      label(val, 160, vy, { bold: true, color: isStatus ? statusColor : '#111827' })
      label(lbl === 'Tanggal' ? 'Pembeli' : lbl === 'Nomor Order' ? 'Email' : '', W / 2 + 10, vy, { color: gray })
      if (lbl === 'Tanggal') label(order.user?.name ?? '-', W / 2 + 80, vy, { bold: true })
      if (lbl === 'Nomor Order') label(order.user?.email ?? '-', W / 2 + 80, vy, { bold: true, size: 7.5 })
    }

    metaRow('Tanggal', new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }), y)
    y += ROW
    metaRow('Nomor Order', order.groupId ?? `#${order.id}`, y)
    y += ROW
    metaRow('Status', statusLabel, y, true)
    y += ROW + 8

    label('Rincian Pembelian', 50, y, { bold: true, size: 9, color: blue })
    y += 14
    doc.moveTo(50, y).lineTo(W - 50, y).strokeColor('#E2E8F0').lineWidth(0.5).stroke()
    y += 6

    doc.rect(50, y, W - 100, 20).fill(lightGray)
    const thY = y + 6
    label('Produk', 58, thY, { bold: true, size: 7.5, color: blue })
    label('Kategori', 270, thY, { bold: true, size: 7.5, color: blue })
    label('Qty', 370, thY, { bold: true, size: 7.5, color: blue })
    label('Harga', 410, thY, { bold: true, size: 7.5, color: blue })
    label('Total', W - 100, thY, { bold: true, size: 7.5, color: blue, width: 50, align: 'right' })
    y += 26

    const titleMaxChars = 38
    for (const item of allOrders) {
      const titleDisplay = item.product.title.length > titleMaxChars
        ? item.product.title.slice(0, titleMaxChars) + '…'
        : item.product.title
      const itemSubtotal = Math.round(item.product.price * item.quantity)
      label(titleDisplay, 58, y, { size: 8 })
      label(item.product.section?.title ?? 'Instagram', 270, y, { size: 8 })
      label(String(item.quantity), 370, y, { size: 8 })
      label(`Rp ${item.product.price.toLocaleString('id-ID')}`, 410, y, { size: 8 })
      label(`Rp ${itemSubtotal.toLocaleString('id-ID')}`, W - 100, y, { size: 8, width: 50, align: 'right' })
      y += 16
      doc.moveTo(50, y).lineTo(W - 50, y).strokeColor('#E2E8F0').lineWidth(0.5).stroke()
      y += 10
    }

    const tX = W - 200
    const totalRow = (lbl: string, val: string, bold = false, extraY = 0) => {
      label(lbl, tX, y, { color: gray, size: 8 })
      label(val, tX + 80, y + extraY, { bold, size: bold ? 10 : 8, color: bold ? blue : '#111827', width: 70, align: 'right' })
      y += bold ? 4 : 16
    }
    totalRow('Subtotal', `Rp ${grandSubtotal.toLocaleString('id-ID')}`)
    totalRow('Biaya Layanan', `Rp ${SERVICE_FEE.toLocaleString('id-ID')}`)
    doc.moveTo(tX, y + 2).lineTo(W - 50, y + 2).strokeColor('#CBD5E1').lineWidth(0.8).stroke()
    y += 10
    totalRow('Total', `Rp ${grandTotal.toLocaleString('id-ID')}`, true)

    const footerY = 780
    doc.rect(0, footerY, W, 62).fill(lightGray)
    doc.fontSize(7.5).font('Helvetica').fillColor(gray)
      .text('Terima kasih telah berbelanja di Buymium. Simpan invoice ini sebagai bukti pembayaran Anda.', 50, footerY + 12, { align: 'center', width: W - 100, lineBreak: false })
    doc.fontSize(7).fillColor('#9CA3AF')
      .text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 50, footerY + 30, { align: 'center', width: W - 100, lineBreak: false })

    doc.end()
  } catch {
    if (!res.headersSent) res.status(500).json({ error: 'Gagal membuat invoice' })
  }
})

export default router
