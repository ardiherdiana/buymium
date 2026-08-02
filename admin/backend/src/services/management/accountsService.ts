import db from '../../config/database'
import { getGoogleSheetsClientReadOnly, getGoogleSheetsClient, getHttpClient } from './googleSheets/client'
import { logger } from '../../utils/logger'
import { enqueueRapidApiCall } from '../../utils/rapidApiQueue'
import type { Account, Source } from '@prisma/client'
import type { sheets_v4 } from 'googleapis'
import { Prisma } from '@prisma/client'
import { encrypt } from '../../utils/encrypt'
import { detectSheetColumns, parseCapital, SHEET_HEADER_RANGE, SHEET_DATA_RANGE, SHEET_SCAN_RANGE, STATUS_COLUMN_INDEX } from './googleSheets/sheetColumns'

const prisma = db

// Short-lived cache for sheet metadata/values. A batch scan fires one HTTP request
// per account, and each used to re-fetch the same spreadsheet metadata + values
// (~3 Sheets API calls per account) — enough to exhaust the read quota and leave
// rows silently uncolored. Cached per (spreadsheetId, sheetName) instead.
const SHEETS_CACHE_TTL_MS = 5 * 60 * 1000
const sheetIdCache = new Map<string, { value: number | null; at: number }>()
const sheetValuesCache = new Map<string, { values: (string | number | boolean | null)[][]; at: number }>()

function sheetsCacheKey(spreadsheetId: string, sheetName: string) {
  return `${spreadsheetId}::${sheetName}`
}

function clearSheetsCache() {
  sheetIdCache.clear()
  sheetValuesCache.clear()
}

// Retry Google Sheets API calls on rate-limit/quota errors with backoff.
async function withSheetsRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 3
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const e = err as { code?: number; response?: { status?: number } }
      const status = e.response?.status ?? e.code
      if ((status === 429 || status === 503) && attempt < maxAttempts - 1) {
        const delay = (attempt + 1) * 15000 // 15s, 30s
        logger.warn(`Google Sheets API rate limited (${status}), retrying in ${delay / 1000}s...`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

export const AccountsService = {
  // Syncs every registered Source: for each, reads its own spreadsheet and iterates
  // every tab within it. Each tab name becomes the account's `sourceSheetName`.
  async syncAll() {
    const sources = await prisma.source.findMany({ orderBy: { id: 'asc' } })

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
        logger.error(`Error syncing source '${source.name}':`, error)
      }
    }

    logger.info(`Successfully synced ${syncedCount} accounts from ${totalSheets} sheet(s) across ${sources.length} source(s)`)
    return { syncedCount, totalSheets, totalSources: sources.length, perSource }
  },

  // Syncs a single Source: reads its spreadsheet, iterates every tab, deletes existing
  // unsold accounts for that source, and re-inserts fresh rows from all its tabs.
  async syncSource(source: Source) {
    const spreadsheetId = source.spreadsheetId

    try {
      const { sheets } = await getGoogleSheetsClientReadOnly()
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })

      let sheetsData = spreadsheet.data.sheets || []

      if (!sheetsData.length) {
        logger.warn(`No sheets found in spreadsheet for source '${source.name}'`)
        return { syncedCount: 0, totalSheets: 0 }
      }

      sheetsData = sheetsData.sort((a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0))

      // Reset status column (Target Followers) background to white for rows 2-500 across all sheets before sync
      try {
        const { sheets: sheetsWrite } = await getGoogleSheetsClient()
        const resetRequests = sheetsData
          .map(sheet => sheet.properties?.sheetId)
          .filter((id): id is number => id !== null && id !== undefined)
          .map(sheetId => ({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: STATUS_COLUMN_INDEX, endColumnIndex: STATUS_COLUMN_INDEX + 1 },
              cell: { userEnteredFormat: { backgroundColor: { red: 1.0, green: 1.0, blue: 1.0 } } },
              fields: 'userEnteredFormat.backgroundColor',
            },
          }))
        if (resetRequests.length > 0) {
          await sheetsWrite.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: resetRequests },
          })
          logger.info(`Reset status column colors for ${resetRequests.length} sheet(s) in source '${source.name}'`)
        }
      } catch (error) {
        logger.warn(`Failed to reset status column colors for source '${source.name}': ${error}`)
      }

      // Wrap entire sync (deletion + insertions) in one transaction, matching prior logic
      // Increase timeout to 60s since sync can involve many Google Sheets API calls
      const result = await prisma.$transaction(
        async (tx) => {
          const deletedCount = await tx.account.deleteMany({
            where: { sourceId: source.id, isSold: false },
          })
          logger.info(`Deleted ${deletedCount.count} existing accounts (is_sold = false) for source '${source.name}'`)

          let syncedCount = 0
          let orderIndex = 1
          const totalSheets = sheetsData.length

          for (const sheet of sheetsData) {
            const sheetName = sheet.properties?.title
            if (!sheetName) continue
            const { sheets: sheetsForRead } = await getGoogleSheetsClientReadOnly()

            const headerRange = `'${sheetName}'!${SHEET_HEADER_RANGE}`
            let headerRow: (string | number | boolean | null)[] = []
            try {
              const headerResponse = await sheetsForRead.spreadsheets.values.get({
                spreadsheetId,
                range: headerRange,
              })
              headerRow = (headerResponse.data.values?.[0] || []) as (string | number | boolean | null)[]
            } catch (error) {
              logger.warn(`Could not read header from sheet '${sheetName}': ${error}`)
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
              aplikasi: loginAppIndex,
              capital: capitalIndex,
            } = detectSheetColumns(headerRow)

            const range = `'${sheetName}'!${SHEET_DATA_RANGE}`
            let values: (string | number | boolean | null)[][] = []
            try {
              const response = await sheetsForRead.spreadsheets.values.get({
                spreadsheetId,
                range,
              })
              values = (response.data.values || []) as (string | number | boolean | null)[][]
            } catch (error) {
              logger.warn(`Could not read data from sheet '${sheetName}': ${error}`)
            }

            if (!values.length) {
              continue
            }

            for (let i = 0; i < values.length; i++) {
              const row = values[i]

              if (!row || (row[emailIndex] && !String(row[emailIndex]).trim())) {
                continue
              }

              const email = row[emailIndex] ? String(row[emailIndex]).trim() : null
              const username = row[usernameIndex] ? String(row[usernameIndex]).trim() : null
              const password = row[passwordIndex] ? String(row[passwordIndex]).trim() : null
              const passwordEmail = passwordEmailIndex >= 0 && row[passwordEmailIndex] ? String(row[passwordEmailIndex]).trim() : null
              const twoFa = twoFaIndex >= 0 && row[twoFaIndex] ? String(row[twoFaIndex]).trim() : null
              const year = yearIndex >= 0 && row[yearIndex] ? String(row[yearIndex]).trim() : null

              let targetFollowers: number | null = null
              if (row[followersIndex] && String(row[followersIndex]).trim()) {
                const followersValue = String(row[followersIndex]).trim()
                const parsed = followersValue.replace(/[^0-9]/g, '')
                targetFollowers = parsed ? parseInt(parsed) : null
              }

              const loginApp = row[loginAppIndex] ? String(row[loginAppIndex]).trim() : null
              const phoneModel = row[hpIndex] ? String(row[hpIndex]).trim() : null
              const capital = parseCapital(row[capitalIndex] ?? null)

              if (!email && !username) {
                continue
              }

              try {
                await tx.account.create({
                  data: {
                    orderIndex,
                    email: email || null,
                    passwordEmail: passwordEmail ? encrypt(passwordEmail) : null,
                    username: username || null,
                    password: password ? encrypt(password) : null,
                    twoFactorAuth: twoFa ? encrypt(twoFa) : null,
                    year: year || null,
                    targetFollowers: targetFollowers || 0,
                    currentFollowers: null,
                    accountStatus: null,
                    loginApp: loginApp || null,
                    capital: capital || null,
                    phoneModel: phoneModel || null,
                    sourceSheetName: sheetName,
                    sourceId: source.id,
                    isSold: false,
                  },
                })

                syncedCount++
                orderIndex++
              } catch (error) {
                if ((error as { code?: string })?.code === 'P2002') {
                  const constraint = (error as { meta?: { target?: string[] } })?.meta?.target?.[0]
                  logger.warn(`Skipping duplicate account row ${i + 1} from sheet '${sheetName}' - ${constraint} already exists`)
                } else {
                  logger.error(`Error syncing account row ${i + 1} from sheet '${sheetName}': ${error}`)
                }
              }
            }
          }

          logger.info(`Successfully synced ${syncedCount} accounts from ${totalSheets} sheet(s) for source '${source.name}'`)
          return { syncedCount, totalSheets }
        },
        { timeout: 60000 }
      )

      // Sync reshuffles row positions and resets colors — drop any cached sheet data
      clearSheetsCache()

      return result
    } catch (error) {
      logger.error(`Error syncing source '${source.name}': ${error}`)
      throw error
    }
  },

  async refreshFollowers(accountId: number) {
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { source: true },
      })

      if (!account) {
        throw new Error('Account not found')
      }

      if (!account.username) {
        throw new Error('Account does not have a username')
      }

      const rapidApiKey = process.env.RAPID_API_KEY
      if (!rapidApiKey) {
        throw new Error('RapidAPI key is not configured')
      }

      const username = String(account.username).replace('@', '').trim()

      if (!username) {
        throw new Error('Invalid username')
      }

      logger.info(`Fetching followers for username: ${username}`)

      const httpClient = await getHttpClient()
      const response = await enqueueRapidApiCall(() =>
        httpClient.get('https://instagram-looter2.p.rapidapi.com/profile2', {
          params: { username },
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'instagram-looter2.p.rapidapi.com',
          },
        })
      )

      const data = response.data

      logger.info(`RapidAPI response for account ID ${account.id} (${account.username}): ${JSON.stringify(data)}`)

      if (data.status === false) {
        const errorMessage = data.errorMessage || data.message || 'Account not found on Instagram'

        logger.warn(`Instagram account not found for account ID ${account.id} (${account.username}): ${errorMessage}`)

        await prisma.account.update({
          where: { id: account.id },
          data: { accountStatus: 'error' },
        })

        try {
          await this.updateGoogleSheetsScanStatus(account, 'error')
        } catch (error) {
          logger.error(`Failed to update Google Sheets for account ID ${account.id}: ${error}`)
        }

        const notFoundError = new Error(`Instagram account '${username}' tidak ditemukan. ${errorMessage}`) as Error & { errorStatusMarked?: boolean }
        notFoundError.errorStatusMarked = true
        throw notFoundError
      }

      // 0 is a valid follower count — only treat missing/null as an error
      if (data.follower_count === undefined || data.follower_count === null) {
        logger.warn(
          `Follower count not found in API response for account ID ${account.id} (${account.username}). Response keys: ${Object.keys(data || {}).join(', ')}`
        )
        throw new Error(data.errorMessage || 'Follower count tidak ditemukan dalam response API')
      }

      const followerCount = parseInt(String(data.follower_count))

      const status = account.targetFollowers != null && followerCount >= account.targetFollowers ? 'completed' : 'progress'
      const sheetStatus = account.targetFollowers != null && followerCount >= account.targetFollowers ? 'success_target_met' : 'success_below_target'

      await prisma.account.update({
        where: { id: account.id },
        data: {
          currentFollowers: followerCount,
          accountStatus: status,
        },
      })

      try {
        await this.updateGoogleSheetsScanStatus(account, sheetStatus)
      } catch (error) {
        logger.error(`Failed to update Google Sheets for account ID ${account.id}: ${error}`)
      }

      logger.info(`Updated followers count for account ID ${account.id} (${account.username}): ${followerCount}`)

      return {
        success: true,
        follower_count: followerCount,
      }
    } catch (error) {
      logger.error(`Error refreshing followers for account ID ${accountId}: ${error}`)

      // Any other failure (RapidAPI timeout/5xx, missing follower_count, etc.)
      // must still mark the row as error in DB + sheet — otherwise the row stays
      // silently white in the spreadsheet with no trace of what happened.
      if (!(error as { errorStatusMarked?: boolean })?.errorStatusMarked) {
        try {
          const account = await prisma.account.findUnique({
            where: { id: accountId },
            include: { source: true },
          })
          if (account) {
            await prisma.account.update({
              where: { id: account.id },
              data: { accountStatus: 'error' },
            })
            await this.updateGoogleSheetsScanStatus(account, 'error')
          }
        } catch (markError) {
          logger.error(`Failed to mark scan error for account ID ${accountId}: ${markError}`)
        }
      }

      throw error
    }
  },

  async updateGoogleSheetsScanStatus(account: Account & { source?: { spreadsheetId?: string | null } | null }, status: string) {
    if (!account.source?.spreadsheetId || !account.sourceSheetName) {
      logger.warn(`Cannot update Google Sheets for account ID ${account.id}: missing source, spreadsheet_id, or source_sheet_name`)
      return
    }

    try {
      const spreadsheetId = account.source.spreadsheetId
      const { sheets } = await getGoogleSheetsClient()
      const sheetName = account.sourceSheetName
      const cacheKey = sheetsCacheKey(spreadsheetId, sheetName)

      const cachedValues = sheetValuesCache.get(cacheKey)
      let values: (string | number | boolean | null)[][]
      if (cachedValues && Date.now() - cachedValues.at < SHEETS_CACHE_TTL_MS) {
        values = cachedValues.values
      } else {
        const range = `'${sheetName}'!${SHEET_SCAN_RANGE}`
        const response = await withSheetsRetry(() =>
          sheets.spreadsheets.values.get({ spreadsheetId, range })
        )
        values = (response.data.values || []) as (string | number | boolean | null)[][]
        sheetValuesCache.set(cacheKey, { values, at: Date.now() })
      }

      if (!values.length) {
        logger.warn(`No data found in sheet '${sheetName}' for account ID ${account.id}`)
        return
      }

      const cachedSheetId = sheetIdCache.get(cacheKey)
      let sheetId: number | null
      if (cachedSheetId && Date.now() - cachedSheetId.at < SHEETS_CACHE_TTL_MS) {
        sheetId = cachedSheetId.value
      } else {
        sheetId = await this.getSheetId(sheets, spreadsheetId, sheetName)
      }
      if (sheetId === null) {
        logger.warn(`Could not find sheet '${sheetName}' in spreadsheet '${spreadsheetId}' for account ID ${account.id}`)
        return
      }

      let rowNumber: number | null = null
      for (let i = 0; i < values.length; i++) {
        const row = values[i]
        const rowEmail = row[0] ? String(row[0]).trim() : ''
        const rowUsername = row[2] ? String(row[2]).trim() : ''

        const accountEmail = account.email ? String(account.email).trim() : ''
        const accountUsername = account.username ? String(account.username).trim() : ''

        if ((accountEmail && rowEmail === accountEmail) || (accountUsername && rowUsername === accountUsername)) {
          rowNumber = i + 2
          break
        }
      }

      if (rowNumber === null) {
        logger.warn(
          `Could not find row for account ID ${account.id} (email: ${account.email}, username: ${account.username}) in sheet '${sheetName}'`
        )
        return
      }

      let backgroundColor: { red: number; green: number; blue: number }
      if (status === 'success_target_met') {
        backgroundColor = {
          red: 198 / 255,
          green: 239 / 255,
          blue: 206 / 255,
        }
      } else if (status === 'success_below_target') {
        backgroundColor = {
          red: 1.0,
          green: 235 / 255,
          blue: 156 / 255,
        }
      } else {
        backgroundColor = {
          red: 1.0,
          green: 198 / 255,
          blue: 206 / 255,
        }
      }

      const requests = [
        {
          updateCells: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: STATUS_COLUMN_INDEX,
              endColumnIndex: STATUS_COLUMN_INDEX + 1,
            },
            rows: [
              {
                values: [
                  {
                    userEnteredFormat: {
                      backgroundColor,
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ]

      await withSheetsRetry(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests,
          },
        })
      )

      logger.info(`Updated Google Sheets status column with background color (${status}) for account ID ${account.id} in sheet '${sheetName}'`)
    } catch (error) {
      logger.error(`Error updating Google Sheets scan status for account ID ${account.id}: ${error}`)
    }
  },

  async getSheetId(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string): Promise<number | null> {
    try {
      const spreadsheet = await withSheetsRetry(() =>
        sheets.spreadsheets.get({ spreadsheetId })
      )

      // One metadata fetch covers every tab — cache them all
      const sheetsData = spreadsheet.data.sheets || []
      let found: number | null = null
      for (const sheet of sheetsData) {
        const title = sheet.properties?.title
        if (!title) continue
        const id = sheet.properties?.sheetId ?? null
        sheetIdCache.set(sheetsCacheKey(spreadsheetId, title), { value: id, at: Date.now() })
        if (title === sheetName) {
          found = id
        }
      }

      return found
    } catch (error) {
      logger.error(`Error getting sheet ID for '${sheetName}': ${error}`)
      return null
    }
  },

  async getAccountsForScan(sourceId?: string) {
    try {
      const where: Prisma.AccountWhereInput = {
        username: { not: null },
        isSold: false,
      }

      if (sourceId && sourceId !== 'all') {
        where.sourceId = parseInt(sourceId)
      }

      const accounts = await prisma.account.findMany({
        where,
        select: { id: true, username: true, orderIndex: true, sourceId: true },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
      })

      return {
        success: true,
        accounts,
        total: accounts.length,
      }
    } catch (error) {
      logger.error('Error getting accounts for scan:', error)
      throw error
    }
  },

  async searchCustomers(search: string) {
    try {
      let where: Prisma.CustomerWhereInput = {}

      if (search) {
        where.OR = [
          { usernameSh: { contains: search } },
          { nomorHp: { contains: search } },
        ]
      }

      const customers = await prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      return {
        success: true,
        customers,
      }
    } catch (error) {
      logger.error('Error searching customers:', error)
      throw error
    }
  },

  async deleteAccountFromGoogleSheets(account: Account & { source?: { spreadsheetId?: string | null } | null }) {
    if (!account.source?.spreadsheetId || !account.sourceSheetName) {
      logger.warn(`Cannot delete from Google Sheets for account ID ${account.id}: missing source, spreadsheet_id, or source_sheet_name`)
      return
    }

    try {
      const spreadsheetId = account.source.spreadsheetId
      const { sheets } = await getGoogleSheetsClient()
      const sheetName = account.sourceSheetName

      const range = `'${sheetName}'!${SHEET_SCAN_RANGE}`
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      })

      const values = response.data.values || []

      if (!values.length) {
        logger.warn(`No data found in sheet '${sheetName}' for account ID ${account.id}`)
        return
      }

      const sheetId = await this.getSheetId(sheets, spreadsheetId, sheetName)
      if (sheetId === null) {
        logger.warn(`Could not find sheet '${sheetName}' in spreadsheet '${spreadsheetId}' for account ID ${account.id}`)
        return
      }

      let rowNumber: number | null = null
      for (let i = 0; i < values.length; i++) {
        const row = values[i]
        const rowEmail = row[0] ? String(row[0]).trim() : ''
        const rowUsername = row[2] ? String(row[2]).trim() : ''

        const accountEmail = account.email ? String(account.email).trim() : ''
        const accountUsername = account.username ? String(account.username).trim() : ''

        if ((accountEmail && rowEmail === accountEmail) || (accountUsername && rowUsername === accountUsername)) {
          rowNumber = i + 2
          break
        }
      }

      if (rowNumber === null) {
        logger.warn(
          `Could not find row for account ID ${account.id} (email: ${account.email}, username: ${account.username}) in sheet '${sheetName}'`
        )
        return
      }

      // Clear Email:Tahun Dibuat(A:F), status color(G), Hp/Aplikasi(H:I) and set Modal(J) to Rp0
      const requests = [
        {
          updateCells: {
            range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 0, endColumnIndex: STATUS_COLUMN_INDEX },
            rows: [{ values: Array.from({ length: STATUS_COLUMN_INDEX }, () => ({ userEnteredValue: {} })) }],
            fields: 'userEnteredValue',
          },
        },
        {
          updateCells: {
            range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: STATUS_COLUMN_INDEX, endColumnIndex: STATUS_COLUMN_INDEX + 1 },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: {},
                    userEnteredFormat: { backgroundColor: { red: 1.0, green: 1.0, blue: 1.0 } },
                  },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat.backgroundColor',
          },
        },
        {
          updateCells: {
            range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 7, endColumnIndex: 9 },
            rows: [{ values: [{ userEnteredValue: {} }, { userEnteredValue: {} }] }],
            fields: 'userEnteredValue',
          },
        },
        {
          updateCells: {
            range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 9, endColumnIndex: 10 },
            rows: [{ values: [{ userEnteredValue: { stringValue: 'Rp0' } }] }],
            fields: 'userEnteredValue',
          },
        },
      ]

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      })

      logger.info(`Cleared account data from Google Sheets for account ID ${account.id} in sheet '${sheetName}'`)
    } catch (error) {
      logger.error(`Error deleting account from Google Sheets for account ID ${account.id}: ${error}`)
      // Don't throw - just log the error
    }
  },
}
