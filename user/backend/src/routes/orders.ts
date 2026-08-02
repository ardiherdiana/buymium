import { Router, Request, Response } from 'express'
import PDFDocument = require('pdfkit')
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { Prisma } from '@prisma/client'
import db from '../config/database'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { CreateOrderSchema, CartOrderSchema } from '../validators'
import { userRateLimit } from '../middleware/userRateLimit'
import { sendOrderCreated, sendProofUploaded } from '../utils/email'
import { reserveInventory, releaseInventory, countAvailableInventory, getVariantPrice, getOrderVariantLabel } from '../utils/inventory'
import { safeDecrypt } from '../utils/encrypt'
import { buildProofUrl } from '../utils/fileAccessToken'
import { sniffImageTypeFromFile, extensionFor } from '../utils/imageSniff'

const router = Router()

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'payment-proofs')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const upload = multer({
  // No extension here — the real one is derived from sniffed magic bytes below, since
  // both the client-supplied mimetype and originalname's extension are spoofable.
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, _file, cb) => {
      cb(null, `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`)
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

async function reserveForProduct(orderId: number, productId: number, quantity: number, variantId?: number, stockIds?: number[], tx?: Prisma.TransactionClient): Promise<boolean> {
  const conn = tx ?? db
  const product = await conn.product.findUnique({ where: { id: productId }, select: { sourceId: true } })
  if (!product?.sourceId) return true
  const reserved = await reserveInventory(orderId, productId, product.sourceId, quantity, variantId, stockIds, tx)
  return reserved >= quantity
}

class InsufficientStockError extends Error {}

router.post('/', requireAuth, userRateLimit, validate(CreateOrderSchema), async (req: Request, res: Response) => {
  const { userId } = req.user!
  const { productId, quantity = 1, variantId, stockIds } = req.body as { productId: number; quantity: number; variantId?: number; stockIds?: number[] }

  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) { res.status(404).json({ error: 'Produk tidak ditemukan' }); return }

  let unitPrice = product.price
  if (variantId) {
    const variantPrice = await getVariantPrice(productId, variantId)
    if (variantPrice === null) { res.status(400).json({ error: 'Variasi tidak valid' }); return }
    unitPrice = variantPrice
  }

  const available = product.sourceId ? await countAvailableInventory(product.id, product.sourceId, variantId) : 0
  if (available < quantity) { res.status(400).json({ error: 'Stok tidak mencukupi' }); return }

  const subtotal = Math.round(unitPrice * quantity)
  const totalPrice = subtotal
  const groupId = generateGroupId('SO', userId)

  let order: { id: number }
  try {
    order = await db.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: { userId, productId, quantity, totalPrice, status: 'pending', groupId },
      })
      const reserved = await reserveForProduct(o.id, productId, quantity, variantId, stockIds, tx)
      if (!reserved) throw new InsufficientStockError()
      return o
    })
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      res.status(409).json({ error: 'Stok baru saja habis dibeli orang lain, silakan pilih produk/variasi lain' })
      return
    }
    throw err
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (user?.email) {
    sendOrderCreated({ to: user.email, name: user.name || 'Pelanggan', groupId, totalPrice, itemCount: quantity }).catch(() => {})
  }

  res.status(201).json({ orderId: order.id, groupId })
})

router.post('/cart', requireAuth, userRateLimit, validate(CartOrderSchema), async (req: Request, res: Response) => {
  const { userId } = req.user!
  const { items } = req.body as { items: { productId: number; quantity: number; variantId?: number; stockIds?: number[] }[] }

  const products = await Promise.all(items.map(it => db.product.findUnique({ where: { id: it.productId } })))
  const unitPrices: number[] = []
  for (let i = 0; i < items.length; i++) {
    if (!products[i]) { res.status(404).json({ error: `Produk ${items[i].productId} tidak ditemukan` }); return }
    const p = products[i]!
    let unitPrice = p.price
    if (items[i].variantId) {
      const variantPrice = await getVariantPrice(p.id, items[i].variantId!)
      if (variantPrice === null) { res.status(400).json({ error: 'Variasi tidak valid' }); return }
      unitPrice = variantPrice
    }
    unitPrices.push(unitPrice)
    const available = p.sourceId ? await countAvailableInventory(p.id, p.sourceId, items[i].variantId) : 0
    if (available < items[i].quantity) {
      res.status(400).json({ error: `Stok "${p.title.slice(0, 30)}" tidak mencukupi` }); return
    }
  }

  const groupId = generateGroupId('CART', userId)

  let orders: { id: number; totalPrice: number }[]
  try {
    orders = await db.$transaction(async (tx) => {
      const created: { id: number; totalPrice: number }[] = []
      for (let i = 0; i < items.length; i++) {
        const totalPrice = Math.round(unitPrices[i] * items[i].quantity)
        const o = await tx.order.create({
          data: { userId, productId: items[i].productId, quantity: items[i].quantity, totalPrice, status: 'pending', groupId },
        })
        created.push(o)
      }
      // Sequential, not Promise.all: an interactive transaction runs on a single
      // connection and can't safely serve concurrent queries.
      for (let i = 0; i < items.length; i++) {
        const reserved = await reserveForProduct(created[i].id, items[i].productId, items[i].quantity, items[i].variantId, items[i].stockIds, tx)
        if (!reserved) throw new InsufficientStockError()
      }
      return created
    })
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      res.status(409).json({ error: 'Sebagian stok di keranjang baru saja habis dibeli orang lain, silakan cek ulang keranjang kamu' })
      return
    }
    throw err
  }

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

  const sniffed = sniffImageTypeFromFile(req.file.path)
  if (!sniffed) {
    fs.unlink(req.file.path, () => {})
    res.status(400).json({ error: 'File harus berupa gambar JPG/PNG/WEBP yang valid' }); return
  }
  const finalFilename = req.file.filename.replace(/\.tmp$/, extensionFor(sniffed))
  const finalPath = path.join(UPLOAD_DIR, finalFilename)
  fs.renameSync(req.file.path, finalPath)

  const order = await db.order.findFirst({ where: { id: orderId, userId } })
  if (!order) {
    fs.unlink(finalPath, () => {})
    res.status(404).json({ error: 'Pesanan tidak ditemukan' }); return
  }
  if (order.status !== 'pending' && order.status !== 'awaiting_confirmation') {
    fs.unlink(finalPath, () => {})
    res.status(400).json({ error: 'Pesanan ini tidak bisa di-update' }); return
  }

  const bankId = bankAccountId ? Number(bankAccountId) : null
  if (bankId) {
    const bank = await db.bankAccount.findFirst({ where: { id: bankId, isActive: true } })
    if (!bank) {
      fs.unlink(finalPath, () => {})
      res.status(400).json({ error: 'Rekening tidak valid' }); return
    }
  }

  if (order.paymentProof) {
    const oldPath = path.join(process.cwd(), order.paymentProof)
    fs.unlink(oldPath, () => {})
  }

  const relativePath = path.join('uploads', 'payment-proofs', finalFilename).replace(/\\/g, '/')

  const updateData: { paymentProof: string; proofUploadedAt: Date; status: string; bankAccountId?: number | null } = {
    paymentProof: relativePath,
    proofUploadedAt: new Date(),
    status: 'awaiting_confirmation',
  }
  if (bankId) updateData.bankAccountId = bankId

  try {
    if (order.groupId) {
      await db.order.updateMany({
        where: { groupId: order.groupId, userId, status: { in: ['pending', 'awaiting_confirmation'] } },
        data: updateData,
      })
    } else {
      await db.order.update({ where: { id: order.id }, data: updateData })
    }
  } catch (err) {
    fs.unlink(req.file.path, () => {})
    throw err
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
    db.order.count({ where: { userId, status: { in: ['pending', 'awaiting_confirmation'] } } }),
    db.order.count({ where: { userId, status: 'paid' } }),
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
    await releaseInventory(ids)
  }

  const orders = await db.order.findMany({
    where: { userId },
    include: {
      product: { select: { id: true, title: true, price: true } },
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
  await releaseInventory([orderId])

  res.json({ message: 'Pesanan berhasil dibatalkan' })
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!
  const orderId = parseInt(req.params.id as string, 10)
  if (isNaN(orderId)) { res.status(400).json({ error: 'ID pesanan tidak valid' }); return }

  let order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: {
      product: true,
      bankAccount: { select: { id: true, bankName: true, accountHolder: true, accountNumber: true, logo: true } },
    },
  })

  if (!order) { res.status(404).json({ error: 'Pesanan tidak ditemukan' }); return }

  const expiryCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  if (order.status === 'pending' && order.createdAt < expiryCutoff) {
    await db.order.update({ where: { id: order.id }, data: { status: 'cancelled' } })
    await releaseInventory([order.id])
    order = { ...order, status: 'cancelled' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let relatedOrders: any[] = []
  if (order.groupId?.startsWith('BUYMIUM-CART-')) {
    relatedOrders = await db.order.findMany({
      where: { groupId: order.groupId, userId },
      include: { product: true },
      orderBy: { id: 'asc' },
    })
  }

  const variantLabel = await getOrderVariantLabel(order.id, order.productId, order.product.sourceId, order.inventoryRefs)
  await Promise.all(
    relatedOrders.map(async (o) => {
      o.variantLabel = await getOrderVariantLabel(o.id, o.productId, o.product.sourceId, o.inventoryRefs)
    })
  )

  const existingTestimonial = await db.testimonial.findUnique({
    where: { orderId: order.id },
    select: { rating: true, message: true },
  })

  res.json({
    ...order,
    subtotal: order.totalPrice,
    variantLabel,
    paymentProofUrl: buildProofUrl(order.paymentProof),
    relatedOrders: relatedOrders,
    hasTestimonial: !!existingTestimonial,
    testimonial: existingTestimonial,
  })
})

router.get('/:id/download', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.user!
  const orderId = parseInt(req.params.id as string, 10)
  if (isNaN(orderId)) { res.status(400).json({ error: 'ID pesanan tidak valid' }); return }

  const order = await db.order.findFirst({
    where: { id: orderId, userId, status: 'paid' },
    include: { product: true },
  })

  if (!order) { res.status(403).json({ error: 'Tidak diizinkan' }); return }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentAccessCount = await db.accountAccessLog.count({
    where: { orderId: order.id, createdAt: { gt: since } },
  })
  if (recentAccessCount >= 5) {
    res.status(429).json({ error: 'Batas download kredensial tercapai, coba lagi besok atau hubungi admin' })
    return
  }
  await db.accountAccessLog.create({
    data: { orderId: order.id, userId, ip: req.ip ?? null },
  })

  type InventoryRef = { id: number }
  const inventoryRefs: InventoryRef[] = (() => {
    try { return order.inventoryRefs ? JSON.parse(order.inventoryRefs) : [] } catch { return [] }
  })()

  if (inventoryRefs.length === 0) {
    res.status(404).json({ error: 'Gagal mengambil data akun. Silakan hubungi admin.' }); return
  }

  let textContent = `PESANAN: ${order.groupId ?? order.id}\n`
  textContent += `PRODUK: ${order.product.title}\n`
  textContent += `JUMLAH: ${order.quantity}\n`
  textContent += `TANGGAL: ${new Date(order.createdAt).toLocaleString('id-ID')}\n`
  textContent += `==========================================\n\n`

  const accountIds = inventoryRefs.map(r => r.id)
  const accounts = accountIds.length ? await db.account.findMany({ where: { id: { in: accountIds } } }) : []

  let index = 0
  let hasBuymiumStoreEmail = false
  let hasHotmailOutlookEmail = false
  let hasTwoFactor = false

  for (const acc of accounts) {
    index += 1
    textContent += `AKUN #${index}\n`
    if (acc.email) textContent += `Email: ${acc.email}\n`
    if (acc.passwordEmail) textContent += `Password Email: ${safeDecrypt(acc.passwordEmail)}\n`
    if (acc.username) textContent += `Username: ${acc.username}\n`
    if (acc.password) textContent += `Password: ${safeDecrypt(acc.password)}\n`
    if (acc.twoFactorAuth) textContent += `2FA: ${safeDecrypt(acc.twoFactorAuth)}\n`
    textContent += `------------------------------------------\n`
    const email = (acc.email || '').toLowerCase()
    if (email.endsWith('@buymium.store')) hasBuymiumStoreEmail = true
    if (email.endsWith('@hotmail.com') || email.endsWith('@outlook.com')) hasHotmailOutlookEmail = true
    if (acc.twoFactorAuth) hasTwoFactor = true
  }
  textContent += `CARA LOGIN\n`
  if (hasBuymiumStoreEmail) {
    textContent += `- Email @buymium.store: gausah login gmail, akses buymium.store lalu paste email tersebut di sana untuk ambil kode OTP.\n`
  }
  if (hasHotmailOutlookEmail) {
    textContent += `- Email @hotmail.com / @outlook.com: login langsung di hotmail.com atau outlook.com.\n`
  }
  if (hasTwoFactor) {
    textContent += `- 2FA: tetap diambil di website buymium.store tab 2FA.\n`
  }
  textContent += `\n`

  textContent += `- Dilarang mengganti email, username, password, dll selama 7 hari setelah login agar menghindari suspend.\n`
  textContent += `- Bisa gunakan akun untuk aktivitas biasa seperti scroll dll agar akun lengket ke perangkat yang baru login.\n\n`

  textContent += `KETENTUAN GARANSI\n`
  textContent += `Jika akun mengalami suspend/banned/disable, penjual akan memberikan:\n`
  textContent += `1. Ganti gratis 1 akun atau\n`
  textContent += `2. Refund 60% cash ke rekening pembeli.\n\n`
  textContent += `Silakan hubungi admin untuk klaim garansi.\n`

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
    include: { product: true, user: true, bankAccount: true },
  })
  if (!order) { res.status(404).json({ error: 'Pesanan tidak ditemukan' }); return }

  let allOrders = [order] as typeof order[]
  if (order.groupId?.startsWith('BUYMIUM-CART-')) {
    const related = await db.order.findMany({
      where: { groupId: order.groupId, userId },
      include: { product: true, user: true, bankAccount: true },
      orderBy: { id: 'asc' },
    })
    if (related.length > 0) allOrders = related as typeof order[]
  }

  const itemSubtotals = allOrders.map((o) => o.totalPrice)
  const grandSubtotal = itemSubtotals.reduce((sum, s) => sum + s, 0)
  const grandTotal = grandSubtotal

  const variantLabels = await Promise.all(
    allOrders.map((o) => getOrderVariantLabel(o.id, o.productId, o.product.sourceId, o.inventoryRefs))
  )

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
    label('Variasi', 270, thY, { bold: true, size: 7.5, color: blue })
    label('Qty', 370, thY, { bold: true, size: 7.5, color: blue })
    label('Harga', 410, thY, { bold: true, size: 7.5, color: blue })
    label('Total', W - 100, thY, { bold: true, size: 7.5, color: blue, width: 50, align: 'right' })
    y += 26

    const titleMaxChars = 38
    for (let i = 0; i < allOrders.length; i++) {
      const item = allOrders[i]
      const titleDisplay = item.product.title.length > titleMaxChars
        ? item.product.title.slice(0, titleMaxChars) + '…'
        : item.product.title
      const itemSubtotal = itemSubtotals[i]
      const unitPrice = Math.round(itemSubtotal / item.quantity)
      label(titleDisplay, 58, y, { size: 8 })
      label(variantLabels[i] ?? '-', 270, y, { size: 8, width: 95 })
      label(String(item.quantity), 370, y, { size: 8 })
      label(`Rp ${unitPrice.toLocaleString('id-ID')}`, 410, y, { size: 8 })
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
