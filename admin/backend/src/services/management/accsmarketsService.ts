import db from '../../config/database'
import { getGoogleSheetsClientReadOnly, getGoogleSheetsClient, getHttpClient } from './googleSheets/client'
import { logger } from '../../utils/logger'
import type { sheets_v4 } from 'googleapis'
import { enqueueRapidApiCall } from '../../utils/rapidApiQueue'
import type { Accsmarket } from '@prisma/client'
import { Prisma } from '@prisma/client'

const prisma = db

export const AccsmarketsService = {
  async sync(sourceId: number) {
    try {
      const source = await prisma.source.findUnique({ where: { id: sourceId } })
      if (!source || !source.spreadsheetId) {
        throw new Error(`Source ${sourceId} not found or has no spreadsheet ID`)
      }

      const spreadsheetId = source.spreadsheetId

      const { sheets } = await getGoogleSheetsClientReadOnly()
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      })

      const sheetsData = spreadsheet.data.sheets || []

      if (!sheetsData.length) {
        logger.warn(`No sheets found in accsmarket spreadsheet for source ${source.name}`)
        return { syncedCount: 0, totalSheets: 0 }
      }

      // Reset column D (index 3) background to white for rows 2-110 across all sheets before sync
      try {
        const { sheets: sheetsWrite } = await getGoogleSheetsClient()
        const resetRequests = sheetsData
          .map(sheet => sheet.properties?.sheetId)
          .filter((id): id is number => id !== null && id !== undefined)
          .map(sheetId => ({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 110, startColumnIndex: 5, endColumnIndex: 6 },
              cell: { userEnteredFormat: { backgroundColor: { red: 1.0, green: 1.0, blue: 1.0 } } },
              fields: 'userEnteredFormat.backgroundColor',
            },
          }))
        if (resetRequests.length > 0) {
          await sheetsWrite.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: resetRequests },
          })
          logger.info(`Reset column D colors for ${resetRequests.length} sheet(s) in source '${source.name}'`)
        }
      } catch (error) {
        logger.warn(`Failed to reset column D colors for source '${source.name}': ${error}`)
      }

      await prisma.accsmarket.deleteMany({
        where: { isSold: false, sourceId: source.id },
      })

      let syncedCount = 0
      let orderIndex = 1
      const totalSheets = sheetsData.length

      for (const sheet of sheetsData) {
        const sheetName = sheet.properties?.title
        if (!sheetName) continue

        logger.info(`Syncing sheet: ${sheetName}`)

        const { sheets: sheetsForRead } = await getGoogleSheetsClientReadOnly()
        const headerRange = `'${sheetName}'!A1:Z1`
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

        let emailIndex = -1,
          passwordEmailIndex = -1,
          usernameIndex = -1,
          passwordIndex = -1,
          twoFaIndex = -1,
          followersIndex = -1,
          capitalIndex = -1

        headerRow.forEach((header: string | number | boolean | null, index: number) => {
          const headerLower = String(header).toLowerCase().trim()
          if (headerLower.includes('password email')) passwordEmailIndex = index
          else if (headerLower.includes('email')) emailIndex = index
          else if (headerLower.includes('username') || headerLower.includes('user')) usernameIndex = index
          else if (headerLower.includes('password') || headerLower.includes('pass')) passwordIndex = index
          else if (headerLower.includes('2fa') || headerLower.includes('auth')) twoFaIndex = index
          else if (headerLower.includes('follower')) followersIndex = index
          else if (headerLower.includes('modal') || headerLower.includes('capital')) capitalIndex = index
        })

        if (emailIndex === -1 && usernameIndex === -1) {
          const range = `'${sheetName}'!A2:A2`
          const sampleResponse = await sheetsForRead.spreadsheets.values.get({
            spreadsheetId,
            range,
          })
          const colCount = sampleResponse.data.values?.[0]?.length || 7

          if (colCount === 3) {
            usernameIndex = 0
            passwordIndex = 1
            twoFaIndex = 2
          } else if (colCount === 6) {
            usernameIndex = 0
            passwordIndex = 1
            twoFaIndex = 2
            followersIndex = 3
            capitalIndex = 5
          } else {
            emailIndex = 0
            passwordEmailIndex = 1
            usernameIndex = 2
            passwordIndex = 3
            twoFaIndex = 4
            followersIndex = 5
            capitalIndex = 6
          }
        }

        const range = `'${sheetName}'!A2:G110`
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

        if (!values.length) continue

        for (let i = 0; i < values.length; i++) {
          const row = values[i]

          if (!row) continue

          const email = emailIndex >= 0 && row[emailIndex] ? String(row[emailIndex]).trim() : null
          const username = usernameIndex >= 0 && row[usernameIndex] ? String(row[usernameIndex]).trim() : null

          if (!email && !username) continue

          const passwordEmail = passwordEmailIndex >= 0 && row[passwordEmailIndex] ? String(row[passwordEmailIndex]).trim() : null
          const password = passwordIndex >= 0 && row[passwordIndex] ? String(row[passwordIndex]).trim() : null
          const twoFa = twoFaIndex >= 0 && row[twoFaIndex] ? String(row[twoFaIndex]).trim() : null

          let targetFollowers = 0
          if (followersIndex >= 0 && row[followersIndex] && String(row[followersIndex]).trim()) {
            const followersValue = String(row[followersIndex]).trim().replace(/[^0-9]/g, '')
            targetFollowers = followersValue ? parseInt(followersValue) : 0
          }

          let capital: number | null = null
          if (capitalIndex >= 0 && row[capitalIndex] && String(row[capitalIndex]).trim()) {
            let capitalValue = String(row[capitalIndex]).trim()
            capitalValue = capitalValue.replace(/Rp\s*/i, '').replace(/[^\d.,]/g, '')

            if (capitalValue.includes(',')) {
              capitalValue = capitalValue.replace(/\./g, '').replace(/,/g, '.')
            } else {
              const parts = capitalValue.split('.')
              if (parts.length > 1) {
                const lastPart = parts[parts.length - 1]
                if (lastPart.length <= 2 && parts.length > 2) {
                  capitalValue = parts.slice(0, -1).join('').replace(/\./g, '') + '.' + lastPart
                } else {
                  capitalValue = capitalValue.replace(/\./g, '')
                }
              }
            }
            capital = capitalValue ? parseFloat(capitalValue) : null
          }

          try {
            await prisma.accsmarket.create({
              data: {
                sourceId: source.id,
                orderIndex,
                email: email || null,
                passwordEmail: passwordEmail || null,
                username: username || null,
                password: password || null,
                twoFactorAuth: twoFa || null,
                targetFollowers: targetFollowers,
                currentFollowers: null,
                accountStatus: null,
                capital: capital,
                sheets: sheetName,
                year: sheetName,
                isSold: false,
              },
            })
            syncedCount++
            orderIndex++
          } catch (error) {
            logger.error(`Error syncing accsmarket row ${i + 1} (Sheet: ${sheetName}): ${error}`)
          }
        }
      }

      logger.info(`Successfully synced ${syncedCount} accounts from ${totalSheets} sheet(s)`)
      return { syncedCount, totalSheets }
    } catch (error) {
      logger.error(`Error syncing accsmarkets: ${error}`)
      throw error
    }
  },

  async refreshFollowers(accsmarketId: number) {
    const accsmarket = await prisma.accsmarket.findUnique({
      where: { id: accsmarketId },
    })

    if (!accsmarket || !accsmarket.username) {
      throw new Error('Account does not have a username')
    }

    const rapidApiKey = process.env.RAPID_API_KEY
    if (!rapidApiKey) {
      throw new Error('RapidAPI key is not configured')
    }

    const username = String(accsmarket.username).replace('@', '').trim()

    if (!username) {
      throw new Error('Invalid username')
    }

    logger.info(`Fetching followers for username: ${username}`)

    try {
      const httpClient = await getHttpClient()
      let response: { data: Record<string, unknown> }

      try {
        response = await enqueueRapidApiCall(() =>
          httpClient.get('https://instagram-looter2.p.rapidapi.com/profile2', {
            params: { username },
            headers: {
              'X-RapidAPI-Key': rapidApiKey,
              'X-RapidAPI-Host': 'instagram-looter2.p.rapidapi.com',
            },
          })
        )
      } catch (httpErr) {
        // HTTP request gagal (network error, 4xx, 5xx) — sama seperti PHP $response->failed()
        // Tidak warnai merah, hanya throw
        const httpErrObj = httpErr as { response?: { data?: { message?: string; error?: string } }; message?: string }
        const errorMessage = httpErrObj?.response?.data?.message || httpErrObj?.response?.data?.error || httpErrObj.message || 'Unknown error'
        logger.error(`RapidAPI error for accsmarket ID ${accsmarket.id} (${accsmarket.username}): ${errorMessage}`)
        throw new Error(`Failed to fetch followers: ${errorMessage}`)
      }

      const data = response.data

      logger.info(`RapidAPI response for accsmarket ID ${accsmarket.id} (${accsmarket.username}): ${JSON.stringify(data)}`)

      // Cek $data['status'] === false — sama persis PHP: isset($data['status']) && $data['status'] === false
      if ('status' in data && data.status === false) {
        const errorMessage = String(data.errorMessage ?? data.message ?? 'Account not found on Instagram.')
        logger.warn(`Instagram account not found for accsmarket ID ${accsmarket.id} (${accsmarket.username}): ${errorMessage}`)

        await prisma.accsmarket.update({
          where: { id: accsmarketId },
          data: { accountStatus: 'error' },
        })

        try {
          await this.updateGoogleSheetsScanStatus(accsmarket, 'error')
        } catch (e) {
          logger.error(`Failed to update Google Sheets for accsmarket ID ${accsmarket.id}: ${e}`)
        }

        throw new Error(`Instagram account '${username}' tidak ditemukan. ${errorMessage}`)
      }

      // Cek !isset($data['follower_count']) — PHP tidak warnai merah di sini, hanya throw
      if (!('follower_count' in data) || data.follower_count === null || data.follower_count === undefined) {
        logger.warn(`Follower count not found in API response for accsmarket ID ${accsmarket.id} (${accsmarket.username}). Response keys: ${Object.keys(data ?? {}).join(', ')}`)
        const errorMessage = String(data.errorMessage ?? 'Follower count tidak ditemukan dalam response API.')
        throw new Error(errorMessage)
      }

      const followerCount = parseInt(String(data.follower_count))
      const targetFollowers = accsmarket.targetFollowers ?? 0
      const status = followerCount >= targetFollowers ? 'completed' : 'progress'
      const sheetStatus = followerCount >= targetFollowers ? 'success_target_met' : 'success_below_target'

      await prisma.accsmarket.update({
        where: { id: accsmarketId },
        data: { currentFollowers: followerCount, accountStatus: status },
      })

      try {
        await this.updateGoogleSheetsScanStatus(accsmarket, sheetStatus)
      } catch (e) {
        logger.error(`Failed to update Google Sheets for accsmarket ID ${accsmarket.id}: ${e}`)
      }

      logger.info(`Updated followers for accsmarket ID ${accsmarket.id} (${accsmarket.username}): current=${followerCount}, target=${targetFollowers}, status=${status}`)

      return { success: true, follower_count: followerCount, account_status: status }
    } catch (error) {
      logger.error(`Error refreshing followers for accsmarket ID ${accsmarket.id} (${accsmarket.username}): ${error}`)

      // General catch — warnai merah (sama seperti PHP catch block)
      await prisma.accsmarket.update({ where: { id: accsmarketId }, data: { accountStatus: 'error' } }).catch(() => {})
      try {
        await this.updateGoogleSheetsScanStatus(accsmarket, 'error')
      } catch (_) {}

      throw error
    }
  },

  async updateGoogleSheetsScanStatus(accsmarket: Accsmarket, status: string) {
    if (!accsmarket.year) {
      logger.warn(`Cannot update Google Sheets: missing year/sheet info`)
      return
    }

    try {
      const source = accsmarket.sourceId ? await prisma.source.findUnique({ where: { id: accsmarket.sourceId } }) : null
      const accsmarketSpreadsheetId = source?.spreadsheetId
      if (!accsmarketSpreadsheetId) {
        logger.warn(`Cannot update Google Sheets: source ${accsmarket.sourceId} has no spreadsheetId`)
        return
      }

      const { sheets } = await getGoogleSheetsClient()
      const sheetName = accsmarket.year || 'Sheet1'

      const range = `'${sheetName}'!A2:G110`
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: accsmarketSpreadsheetId,
        range,
      })

      const values = response.data.values || []
      if (!values.length) return

      const sheetId = await this.getSheetId(sheets, accsmarketSpreadsheetId, sheetName)
      if (sheetId === null) return

      const accountEmail = accsmarket.email ? String(accsmarket.email).trim() : ''
      const accountUsername = accsmarket.username ? String(accsmarket.username).trim() : ''

      let rowNumber: number | null = null
      for (let i = 0; i < values.length; i++) {
        const row = values[i]
        if (!row || !row.length) continue

        const matched = row.some((cell: string | number | boolean | null) => {
          if (!cell) return false
          const cellValue = String(cell).trim()
          return (accountEmail && cellValue === accountEmail) || (accountUsername && cellValue === accountUsername)
        })

        if (matched) {
          rowNumber = i + 2
          break
        }
      }

      if (rowNumber === null) {
        logger.warn(`Could not find row for accsmarket ID ${accsmarket.id} (email: ${accsmarket.email}, username: ${accsmarket.username}) in sheet '${sheetName}'`)
        return
      }

      let backgroundColor: { red: number; green: number; blue: number }
      if (status === 'success_target_met' || status === 'completed') {
        backgroundColor = { red: 198 / 255, green: 239 / 255, blue: 206 / 255 }
      } else if (status === 'success_below_target' || status === 'progress') {
        backgroundColor = { red: 1.0, green: 235 / 255, blue: 156 / 255 }
      } else {
        backgroundColor = { red: 1.0, green: 198 / 255, blue: 206 / 255 }
      }

      const requests = [
        {
          updateCells: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 5,
              endColumnIndex: 6,
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

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: accsmarketSpreadsheetId,
        requestBody: { requests },
      })

      logger.info(`Updated Google Sheets for accsmarket ${accsmarket.id}`)
    } catch (error) {
      logger.error(`Error updating Google Sheets: ${error}`)
    }
  },

  async getSheetId(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string): Promise<number | null> {
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      })

      const sheetsData = spreadsheet.data.sheets || []
      for (const sheet of sheetsData) {
        if (sheet.properties?.title === sheetName) {
          return sheet.properties.sheetId ?? null
        }
      }

      return null
    } catch (error) {
      logger.error(`Error getting sheet ID: ${error}`)
      return null
    }
  },

  async deleteAccountFromGoogleSheets(accsmarket: Accsmarket) {
    if (!accsmarket.year) return

    try {
      const source = accsmarket.sourceId ? await prisma.source.findUnique({ where: { id: accsmarket.sourceId } }) : null
      const accsmarketSpreadsheetId = source?.spreadsheetId
      if (!accsmarketSpreadsheetId) return

      const { sheets } = await getGoogleSheetsClient()
      const sheetName = accsmarket.year
      const range = `'${sheetName}'!A2:G110`

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: accsmarketSpreadsheetId,
        range,
      })

      const values = response.data.values || []
      if (!values.length) return

      const sheetId = await this.getSheetId(sheets, accsmarketSpreadsheetId, sheetName)
      if (sheetId === null) return

      const accountEmail = accsmarket.email ? String(accsmarket.email).trim() : ''
      const accountUsername = accsmarket.username ? String(accsmarket.username).trim() : ''

      let rowNumber: number | null = null
      for (let i = 0; i < values.length; i++) {
        const row = values[i]
        if (!row || !row.length) continue

        const matched = (row as (string | number | boolean | null)[]).some((cell) => {
          if (!cell) return false
          const cellValue = String(cell).trim()
          return (accountEmail && cellValue === accountEmail) || (accountUsername && cellValue === accountUsername)
        })

        if (matched) {
          rowNumber = i + 2
          break
        }
      }

      if (rowNumber === null) {
        logger.warn(`Could not find row for accsmarket ID ${accsmarket.id} (email: ${accsmarket.email}, username: ${accsmarket.username}) in sheet '${sheetName}'`)
        return
      }

      const requests = [
        {
          updateCells: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 0,
              endColumnIndex: 5,
            },
            rows: [
              {
                values: [{}, {}, {}, {}, {}],
              },
            ],
            fields: 'userEnteredValue',
          },
        },
        {
          updateCells: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 5,
              endColumnIndex: 6,
            },
            rows: [
              {
                values: [
                  {
                    userEnteredFormat: {
                      backgroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredFormat.backgroundColor,userEnteredValue',
          },
        },
        {
          updateCells: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 6,
              endColumnIndex: 7,
            },
            rows: [
              {
                values: [{ userEnteredValue: { numberValue: 0 } }],
              },
            ],
            fields: 'userEnteredValue',
          },
        },
      ] as sheets_v4.Schema$Request[]

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: accsmarketSpreadsheetId,
        requestBody: { requests },
      })
    } catch (error) {
      logger.error(`Error deleting from Google Sheets: ${error}`)
      throw error
    }
  },

  async getAccountsForScan(sourceId?: number) {
    try {
      let where: Prisma.AccsmarketWhereInput = {
        username: { not: null },
        isSold: false,
      }

      if (sourceId) {
        where.sourceId = sourceId
      }

      const accsmarkets = await prisma.accsmarket.findMany({
        where,
        select: { id: true, username: true, orderIndex: true, year: true, sourceId: true },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
      })

      return { success: true, accsmarkets, total: accsmarkets.length }
    } catch (error) {
      logger.error('Error getting accounts for scan:', error)
      throw error
    }
  },

  async searchCustomers(search: string, userRole?: { name?: string }, userSourceId?: number) {
    try {
      let where: Prisma.CustomerWhereInput = {}

      if (userRole?.name === 'admin' && userSourceId) {
        where.sourceId = userSourceId
      }

      if (search) {
        where.OR = [{ usernameSh: { contains: search } }, { nomorHp: { contains: search } }]
      }

      const customers = await prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      return { success: true, customers }
    } catch (error) {
      logger.error('Error searching customers:', error)
      throw error
    }
  },
}
