import { Router, Request, Response } from 'express'
import db from '../config/database'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const accounts = await db.bankAccount.findMany({
    where: { isActive: true },
    select: { id: true, bankName: true, accountHolder: true, accountNumber: true, logo: true },
    orderBy: { id: 'asc' },
  })
  res.json(accounts)
})

export default router
