import { Request, Response } from 'express'
import db from '../../config/database'

export class BankAccountsController {
  static async index(_req: Request, res: Response): Promise<void> {
    try {
      const accounts = await db.bankAccount.findMany({ orderBy: { id: 'asc' } })
      res.json(accounts)
    } catch (err) {
      console.error('[BankAccounts List Error]', err)
      res.status(500).json({ success: false, error: 'Failed to fetch bank accounts' })
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { bankName, accountHolder, accountNumber, logo, isActive } = req.body
      const account = await db.bankAccount.create({
        data: { bankName, accountHolder, accountNumber, logo: logo ?? null, isActive: isActive ?? true },
      })
      res.status(201).json(account)
    } catch (err) {
      console.error('[BankAccount Create Error]', err)
      res.status(500).json({ success: false, error: 'Failed to create bank account' })
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      const account = await db.bankAccount.update({ where: { id }, data: req.body })
      res.json(account)
    } catch (err) {
      console.error('[BankAccount Update Error]', err)
      res.status(500).json({ success: false, error: 'Failed to update bank account' })
    }
  }

  static async destroy(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id)
      await db.bankAccount.delete({ where: { id } })
      res.json({ message: 'Bank account deleted' })
    } catch (err) {
      console.error('[BankAccount Delete Error]', err)
      res.status(500).json({ success: false, error: 'Failed to delete bank account' })
    }
  }
}
