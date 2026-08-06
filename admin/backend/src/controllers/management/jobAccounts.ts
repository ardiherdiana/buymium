import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { logger } from '../../utils/logger'
import { safeDecrypt } from '../../utils/encrypt'
import db from '../../config/database'

const prisma = db

export const SALARY_PER_ACCOUNT = 4000

const mapAccount = (a: {
  id: number
  orderIndex: number | null
  employeeName: string
  email: string | null
  username: string
  password: string | null
  year: string | null
  targetFollowers: number | null
  hp: string | null
  aplikasi: string | null
  capital: number | null
  jobType: string
  loginStatus: string
  purchaseDate: Date | null
  dueDate: Date | null
  salaryPaid: boolean
  salaryProofUrl: string | null
  salaryPaidAt: Date | null
  jobSource: { id: number; name: string }
}) => ({
  id: a.id,
  employee_name: a.employeeName,
  email: a.email,
  username: a.username,
  password: safeDecrypt(a.password),
  year: a.year,
  target_followers: a.targetFollowers,
  hp: a.hp,
  aplikasi: a.aplikasi,
  capital: a.capital,
  job_type: a.jobType,
  login_status: a.loginStatus,
  purchase_date: a.purchaseDate,
  due_date: a.dueDate,
  salary: a.loginStatus === 'success' ? SALARY_PER_ACCOUNT : 0,
  salary_paid: a.salaryPaid,
  salary_proof_url: a.salaryProofUrl,
  salary_paid_at: a.salaryPaidAt,
  job_source: a.jobSource,
})

export const JobAccountsController = {
  async index(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = 20
      const search = req.query.search as string
      const employeeName = req.query.employee as string
      const jobType = req.query.job_type as string
      const loginStatus = req.query.login_status as string
      const overdue = req.query.overdue === 'true'
      const hp = req.query.hp as string

      const where: Prisma.JobAccountWhereInput = {}
      if (search) {
        where.OR = [
          { username: { contains: search } },
          { email: { contains: search } },
        ]
      }
      if (employeeName && employeeName !== 'all') where.employeeName = employeeName
      if (jobType && jobType !== 'all') where.jobType = jobType
      if (loginStatus === 'not_success') where.loginStatus = { not: 'success' }
      else if (loginStatus && loginStatus !== 'all') where.loginStatus = loginStatus
      if (hp) where.hp = hp
      if (overdue) {
        where.jobType = 'email_replacement'
        where.dueDate = { lt: new Date() }
        where.loginStatus = { not: 'success' }
      }

      // Stats cards reflect search/employee, independent of the job_type/login_status
      // dropdowns themselves so all 4 numbers stay visible regardless of which one is active.
      const statsWhere: Prisma.JobAccountWhereInput = {}
      if (search) {
        statsWhere.OR = [
          { username: { contains: search } },
          { email: { contains: search } },
        ]
      }
      if (employeeName && employeeName !== 'all') statsWhere.employeeName = employeeName

      const [accounts, total, employees, totalAccounts, loginOnlyCount, emailReplacementCount, selesaiCount, unpaidCount] = await Promise.all([
        prisma.jobAccount.findMany({
          where,
          include: { jobSource: { select: { id: true, name: true } } },
          orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.jobAccount.count({ where }),
        prisma.jobAccount.findMany({ distinct: ['employeeName'], select: { employeeName: true }, orderBy: { employeeName: 'asc' } }),
        prisma.jobAccount.count({ where: statsWhere }),
        prisma.jobAccount.count({ where: { ...statsWhere, jobType: 'login_only' } }),
        prisma.jobAccount.count({ where: { ...statsWhere, jobType: 'email_replacement' } }),
        prisma.jobAccount.count({ where: { ...statsWhere, loginStatus: 'success' } }),
        prisma.jobAccount.count({ where: { ...statsWhere, loginStatus: 'success', salaryPaid: false } }),
      ])

      res.json({
        accounts: accounts.map(mapAccount),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        employees: employees.map((e) => e.employeeName),
        stats: {
          total_accounts: totalAccounts,
          login_only: loginOnlyCount,
          email_replacement: emailReplacementCount,
          selesai: selesaiCount,
          estimasi_gaji: unpaidCount * SALARY_PER_ACCOUNT,
          unpaid_count: unpaidCount,
        },
      })
    } catch (error) {
      logger.error('Error fetching job accounts:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch job accounts' })
    }
  },

  async hpCounts(req: Request, res: Response) {
    try {
      const grouped = await prisma.jobAccount.groupBy({
        by: ['hp'],
        where: { loginStatus: { not: 'success' }, hp: { not: null } },
        _count: { _all: true },
      })

      res.json({ devices: grouped.map((g) => ({ hp: g.hp as string, count: g._count._all })) })
    } catch (error) {
      logger.error('Error fetching job account hp counts:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch counts' })
    }
  },

  async pay(req: Request, res: Response) {
    try {
      const { ids, proof_url } = req.body as { ids: number[]; proof_url?: string }

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids wajib diisi' })
        return
      }

      const result = await prisma.jobAccount.updateMany({
        where: { id: { in: ids.map(Number) }, loginStatus: 'success', salaryPaid: false },
        data: { salaryPaid: true, salaryProofUrl: proof_url ?? null, salaryPaidAt: new Date() },
      })

      res.json({ success: true, updated: result.count })
    } catch (error) {
      logger.error('Error marking job account salary as paid:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to mark salary as paid' })
    }
  },
}
