import db from '../../config/database'
import { getGoogleSheetsClientReadOnly } from './googleSheets/client'
import { logger } from '../../utils/logger'
import { encrypt } from '../../utils/encrypt'
import type { JobSource } from '@prisma/client'
import { detectSheetColumns, parseCapital, SHEET_HEADER_RANGE, SHEET_DATA_RANGE } from './googleSheets/sheetColumns'

const prisma = db

// Employees mark a row's Username cell green (logged in successfully) or red
// (login failed, e.g. wrong password) directly in the sheet. Everything else
// (default/white) is still pending.
const USERNAME_COLUMN_INDEX = 2

function classifyColor(color: { red?: number | null; green?: number | null; blue?: number | null } | undefined | null): 'pending' | 'success' | 'failed' {
  if (!color) return 'pending'
  const r = color.red ?? 1
  const g = color.green ?? 1
  const b = color.blue ?? 1
  // White/unset background
  if (r >= 0.95 && g >= 0.95 && b >= 0.95) return 'pending'
  if (g - Math.max(r, b) > 0.1) return 'success'
  if (r - Math.max(g, b) > 0.1) return 'failed'
  return 'pending'
}

// Last day of the month after purchaseDate's month, e.g. bought 2 Aug -> due 30 Sep.
function computeDueDate(purchaseDate: Date): Date {
  const y = purchaseDate.getFullYear()
  const m = purchaseDate.getMonth()
  return new Date(y, m + 2, 0)
}

export const JobService = {
  async syncAll() {
    const sources = await prisma.jobSource.findMany({ orderBy: { id: 'asc' } })

    let syncedCount = 0
    let totalSheets = 0
    const perSource: { sourceId: number; sourceName: string; syncedCount: number; totalSheets: number }[] = []

    for (const source of sources) {
      try {
        const result = await this.syncSource(source)
        syncedCount += result.syncedCount
        totalSheets += result.totalSheets
        perSource.push({ sourceId: source.id, sourceName: source.name, ...result })
      } catch (error) {
        logger.error(`Error syncing job source '${source.name}':`, error)
      }
    }

    logger.info(`Successfully synced ${syncedCount} job accounts from ${totalSheets} sheet(s) across ${sources.length} job source(s)`)
    return { syncedCount, totalSheets, totalSources: sources.length, perSource }
  },

  async syncSource(source: JobSource) {
    const spreadsheetId = source.spreadsheetId
    const { sheets } = await getGoogleSheetsClientReadOnly()

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    let sheetsData = spreadsheet.data.sheets || []
    if (!sheetsData.length) {
      logger.warn(`No sheets found in spreadsheet for job source '${source.name}'`)
      return { syncedCount: 0, totalSheets: 0 }
    }
    sheetsData = sheetsData.sort((a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0))

    let syncedCount = 0
    let orderIndex = 1
    const seenUsernames = new Set<string>()

    for (const sheet of sheetsData) {
      const sheetName = sheet.properties?.title
      const sheetId = sheet.properties?.sheetId
      if (!sheetName || sheetId === null || sheetId === undefined) continue

      let headerRow: (string | number | boolean | null)[] = []
      try {
        const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${sheetName}'!${SHEET_HEADER_RANGE}`,
        })
        headerRow = (headerResponse.data.values?.[0] || []) as (string | number | boolean | null)[]
      } catch (error) {
        logger.warn(`Could not read header from job sheet '${sheetName}': ${error}`)
      }

      const {
        email: emailIndex,
        passwordEmail: passwordEmailIndex,
        username: usernameIndex,
        password: passwordIndex,
        twoFa: twoFaIndex,
        year: yearIndex,
        targetFollowers: followersIndex,
        hp: hpIndex,
        aplikasi: aplikasiIndex,
        capital: capitalIndex,
      } = detectSheetColumns(headerRow)

      let values: (string | number | boolean | null)[][] = []
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${sheetName}'!${SHEET_DATA_RANGE}`,
        })
        values = (response.data.values || []) as (string | number | boolean | null)[][]
      } catch (error) {
        logger.warn(`Could not read data from job sheet '${sheetName}': ${error}`)
        continue
      }

      if (!values.length) continue

      // One metadata+format fetch for the whole username column's colors, instead of
      // one call per row.
      let colors: ({ red?: number | null; green?: number | null; blue?: number | null } | undefined)[] = []
      try {
        const formatResponse = await sheets.spreadsheets.get({
          spreadsheetId,
          ranges: [`'${sheetName}'!C2:C${values.length + 1}`],
          fields: 'sheets.data.rowData.values.userEnteredFormat.backgroundColor',
        })
        const rowData = formatResponse.data.sheets?.[0]?.data?.[0]?.rowData || []
        colors = rowData.map((row) => row.values?.[0]?.userEnteredFormat?.backgroundColor ?? undefined)
      } catch (error) {
        logger.warn(`Could not read username column colors from job sheet '${sheetName}': ${error}`)
      }

      for (let i = 0; i < values.length; i++) {
        const row = values[i]
        if (!row) continue

        const email = emailIndex >= 0 && row[emailIndex] ? String(row[emailIndex]).trim() : null
        const username = usernameIndex >= 0 && row[usernameIndex] ? String(row[usernameIndex]).trim() : null
        if (!username) continue

        const password = passwordIndex >= 0 && row[passwordIndex] ? String(row[passwordIndex]).trim() : null
        const passwordEmail = passwordEmailIndex >= 0 && row[passwordEmailIndex] ? String(row[passwordEmailIndex]).trim() : null
        const twoFa = twoFaIndex >= 0 && row[twoFaIndex] ? String(row[twoFaIndex]).trim() : null
        const year = yearIndex >= 0 && row[yearIndex] ? String(row[yearIndex]).trim() : null

        let targetFollowers: number | null = null
        if (followersIndex >= 0 && row[followersIndex] && String(row[followersIndex]).trim()) {
          const parsed = String(row[followersIndex]).trim().replace(/[^0-9]/g, '')
          targetFollowers = parsed ? parseInt(parsed) : null
        }

        const hp = hpIndex >= 0 && row[hpIndex] ? String(row[hpIndex]).trim() : null
        const aplikasi = aplikasiIndex >= 0 && row[aplikasiIndex] ? String(row[aplikasiIndex]).trim() : null
        const capital = parseCapital(capitalIndex >= 0 ? row[capitalIndex] ?? null : null)

        seenUsernames.add(username)

        try {
          const existing = await prisma.jobAccount.findUnique({
            where: { jobSourceId_username: { jobSourceId: source.id, username } },
          })

          // jobType reflects the purchase method and must stay fixed once set - an
          // email_replacement row that later gets its email filled in is still an
          // email_replacement row (just done), not a login_only row.
          const jobType = existing?.jobType ?? (email ? 'login_only' : 'email_replacement')

          // For email_replacement, the sheet color alone isn't enough to call it done -
          // the email column has to actually be filled in, otherwise it stays pending
          // even if the employee already colored the username cell green.
          const colorStatus = classifyColor(colors[i])
          const loginStatus = jobType === 'email_replacement' && !email && colorStatus === 'success' ? 'pending' : colorStatus

          const purchaseDate = existing?.purchaseDate ?? new Date()
          const dueDate = jobType === 'email_replacement' ? computeDueDate(purchaseDate) : null

          await prisma.jobAccount.upsert({
            where: { jobSourceId_username: { jobSourceId: source.id, username } },
            create: {
              orderIndex,
              jobSourceId: source.id,
              employeeName: sheetName,
              email,
              passwordEmail: passwordEmail ? encrypt(passwordEmail) : null,
              username,
              password: password ? encrypt(password) : null,
              twoFactorAuth: twoFa ? encrypt(twoFa) : null,
              year,
              targetFollowers,
              hp,
              aplikasi,
              capital,
              jobType,
              loginStatus,
              purchaseDate,
              dueDate,
            },
            update: {
              orderIndex,
              employeeName: sheetName,
              email,
              passwordEmail: passwordEmail ? encrypt(passwordEmail) : null,
              password: password ? encrypt(password) : null,
              twoFactorAuth: twoFa ? encrypt(twoFa) : null,
              year,
              targetFollowers,
              hp,
              aplikasi,
              capital,
              jobType,
              loginStatus,
              dueDate,
            },
          })

          syncedCount++
          orderIndex++
        } catch (error) {
          logger.error(`Error syncing job account row ${i + 1} from sheet '${sheetName}': ${error}`)
        }
      }
    }

    // Rows removed from the sheet (or moved out of range) shouldn't linger in the DB.
    const deleted = await prisma.jobAccount.deleteMany({
      where: { jobSourceId: source.id, username: { notIn: Array.from(seenUsernames) } },
    })
    if (deleted.count > 0) {
      logger.info(`Removed ${deleted.count} stale job account(s) no longer in sheet for job source '${source.name}'`)
    }

    logger.info(`Successfully synced ${syncedCount} job accounts from ${sheetsData.length} sheet(s) for job source '${source.name}'`)
    return { syncedCount, totalSheets: sheetsData.length }
  },
}
