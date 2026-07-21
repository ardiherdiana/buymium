import { Request, Response } from 'express'
import { logger } from '../../utils/logger'
import db from '../../config/database'

const prisma = db

export const UpfollVendorsController = {
  async index(req: Request, res: Response) {
    try {
      const vendors = await prisma.upfollVendor.findMany({
        include: { tiers: true },
        orderBy: { name: 'asc' },
      })

      const vendorsWithMapping = vendors.map((v) => ({
        id: v.id,
        name: v.name,
        is_active: v.isActive,
        created_at: v.createdAt,
        tiers: v.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          target_followers: t.targetFollowers,
          price: t.price,
        })),
      }))

      res.json({ vendors: vendorsWithMapping })
    } catch (error) {
      logger.error('Gagal mengambil data vendor upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal mengambil data vendor upfoll' })
    }
  },

  async show(req: Request, res: Response) {
    try {
      const { id } = req.params
      const vendor = await prisma.upfollVendor.findUnique({
        where: { id: parseInt(id) },
        include: { tiers: true },
      })
      if (!vendor) return res.status(404).json({ error: 'Vendor tidak ditemukan' })
      res.json({ vendor })
    } catch (error) {
      logger.error('Gagal mengambil detail vendor upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal mengambil detail vendor upfoll' })
    }
  },

  async store(req: Request, res: Response) {
    try {
      const { name, is_active } = req.body
      const vendor = await prisma.upfollVendor.create({
        data: { name, isActive: is_active ?? true },
      })
      res.status(201).json({ success: true, vendor })
    } catch (error) {
      logger.error('Gagal membuat vendor upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal membuat vendor' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, is_active } = req.body
      const vendor = await prisma.upfollVendor.update({
        where: { id: parseInt(id) },
        data: {
          ...(name !== undefined && { name }),
          ...(is_active !== undefined && { isActive: is_active }),
        },
      })
      res.json({ success: true, vendor })
    } catch (error) {
      logger.error('Gagal memperbarui vendor upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal memperbarui vendor' })
    }
  },

  async destroy(req: Request, res: Response) {
    try {
      const { id } = req.params
      await prisma.upfollVendor.delete({ where: { id: parseInt(id) } })
      res.json({ success: true, message: 'Vendor berhasil dihapus' })
    } catch (error) {
      logger.error('Gagal menghapus vendor upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal menghapus vendor' })
    }
  },

  // Tier milik vendor masing-masing (tidak ada katalog bersama) — tiap vendor
  // menentukan sendiri paket target followers dan harganya.
  async storeTier(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, target_followers, price } = req.body
      const vendorId = parseInt(id)

      const tier = await prisma.upfollVendorTier.create({
        data: { vendorId, name, targetFollowers: parseInt(target_followers), price: parseFloat(price) },
      })

      res.status(201).json({ success: true, tier })
    } catch (error) {
      logger.error('Gagal membuat tier vendor upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal membuat tier vendor' })
    }
  },

  async updateTier(req: Request, res: Response) {
    try {
      const { vendorTierId } = req.params
      const { name, target_followers, price } = req.body
      const id = parseInt(vendorTierId)

      const tier = await prisma.upfollVendorTier.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(target_followers !== undefined && { targetFollowers: parseInt(target_followers) }),
          ...(price !== undefined && { price: parseFloat(price) }),
        },
      })

      res.json({ success: true, tier })
    } catch (error) {
      logger.error('Gagal memperbarui tier vendor upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal memperbarui tier vendor' })
    }
  },

  async destroyTier(req: Request, res: Response) {
    try {
      const { vendorTierId } = req.params
      await prisma.upfollVendorTier.delete({ where: { id: parseInt(vendorTierId) } })
      res.json({ success: true, message: 'Tier vendor berhasil dihapus' })
    } catch (error) {
      logger.error('Gagal menghapus tier vendor upfoll:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal menghapus tier vendor — mungkin masih dipakai pesanan' })
    }
  },
}
