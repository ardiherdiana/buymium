import db from '../../config/database'
import { getGoogleSheetsClientReadOnly, getGoogleSheetsClient, getHttpClient } from './googleSheets/client'
import { logger } from '../../utils/logger'
import axios from 'axios'
import { enqueueRapidApiCall } from '../../utils/rapidApiQueue'
import type { Source, Account } from '@prisma/client'
import type { sheets_v4 } from 'googleapis'
import { Prisma } from '@prisma/client'

const prisma = db

export const AccountsService = {
  async sync(sourceId: string) {
    try {
      const source = await prisma.source.findUnique({
        where: { id: parseInt(sourceId) },
      })

      if (!source) {
        throw new Error('Source not found')
      }

      if (!source.spreadsheetId) {
        throw new Error('Source does not have a spreadsheet ID configured')
      }

      const result = await this.syncSource(source)
      return result
    } catch (error) {
      logger.error(`Error syncing source '${sourceId}':`, error)
      throw error
    }
  },

  async syncSource(source: Source) {
    if (!source.spreadsheetId) {
      throw new Error(`Source '${source.name}' does not have a spreadsheet ID configured`)
    }

    try {
      const { sheets } = await getGoogleSheetsClientReadOnly()
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: source.spreadsheetId ?? undefined,
      })

      let sheetsData = spreadsheet.data.sheets || []

      if (!sheetsData.length) {
        logger.warn(`No sheets found in spreadsheet for source '${source.name}'`)
        return { syncedCount: 0, totalSheets: 0 }
      }

      // Sort sheets by index to process in correct order (0, 1, 2, ...) matching PHP production behavior
      sheetsData = sheetsData.sort((a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0))

      // Reset column D (index 3) background to white for rows 2-110 across all sheets before sync
      try {
        const { sheets: sheetsWrite } = await getGoogleSheetsClient()
        const resetRequests = sheetsData
          .map(sheet => sheet.properties?.sheetId)
          .filter((id): id is number => id !== null && id !== undefined)
          .map(sheetId => ({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 110, startColumnIndex: 3, endColumnIndex: 4 },
              cell: { userEnteredFormat: { backgroundColor: { red: 1.0, green: 1.0, blue: 1.0 } } },
              fields: 'userEnteredFormat.backgroundColor',
            },
          }))
        if (resetRequests.length > 0) {
          await sheetsWrite.spreadsheets.batchUpdate({
            spreadsheetId: source.spreadsheetId ?? undefined,
            requestBody: { requests: resetRequests },
          })
          logger.info(`Reset column D colors for ${resetRequests.length} sheet(s) in source '${source.name}'`)
        }
      } catch (error) {
        logger.warn(`Failed to reset column D colors for source '${source.name}': ${error}`)
      }

      // Wrap entire sync (deletion + insertions) in one transaction, matching PHP logic
      // Increase timeout to 60s since sync can involve many Google Sheets API calls
      const result = await prisma.$transaction(
        async (tx) => {
          const deletedCount = await tx.account.deleteMany({
          where: {
            sourceId: source.id,
            isSold: false,
          },
        })
        logger.info(`Deleted ${deletedCount} existing accounts (is_sold = false) for source ID: ${source.id} (${source.name})`)

        let syncedCount = 0
        let orderIndex = 1
        const totalSheets = sheetsData.length

        for (const sheet of sheetsData) {
          const sheetName = sheet.properties?.title
          if (!sheetName) continue
          const { sheets: sheetsForRead } = await getGoogleSheetsClientReadOnly()

          const headerRange = `${sheetName}!A1:F1`
          let headerRow: (string | number | boolean | null)[] = []
          try {
            const headerResponse = await sheetsForRead.spreadsheets.values.get({
              spreadsheetId: source.spreadsheetId ?? undefined,
              range: headerRange,
            })
            headerRow = (headerResponse.data.values?.[0] || []) as (string | number | boolean | null)[]
          } catch (error) {
            logger.warn(`Could not read header from sheet '${sheetName}': ${error}`)
          }

          let emailIndex = -1
          let usernameIndex = -1
          let passwordIndex = -1
          let followersIndex = -1
          let loginAppIndex = -1
          let capitalIndex = -1

          headerRow.forEach((header: string | number | boolean | null, index: number) => {
            const headerLower = String(header).toLowerCase().trim()
            if (headerLower.includes('email')) emailIndex = index
            else if (headerLower.includes('username')) usernameIndex = index
            else if (headerLower.includes('password')) passwordIndex = index
            else if (headerLower.includes('jumlah') && headerLower.includes('followers')) followersIndex = index
            else if (headerLower.includes('aplikasi') && headerLower.includes('login')) loginAppIndex = index
            else if (headerLower.includes('modal')) capitalIndex = index
          })

          if (emailIndex === -1) {
            emailIndex = 0
            usernameIndex = 1
            passwordIndex = 2
            followersIndex = 3
            loginAppIndex = 4
            capitalIndex = 5
          }

          const range = `'${sheetName}'!A2:F110`
          let values: (string | number | boolean | null)[][] = []
          try {
            const response = await sheetsForRead.spreadsheets.values.get({
              spreadsheetId: source.spreadsheetId ?? undefined,
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

            let targetFollowers: number | null = null
            if (row[followersIndex] && String(row[followersIndex]).trim()) {
              const followersValue = String(row[followersIndex]).trim()
              const parsed = followersValue.replace(/[^0-9]/g, '')
              targetFollowers = parsed ? parseInt(parsed) : null
            }

            const loginApp = row[loginAppIndex] ? String(row[loginAppIndex]).trim() : null

            let capital: number | null = null
            if (row[capitalIndex] && String(row[capitalIndex]).trim()) {
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

            if (!email && !username) {
              continue
            }

            try {
              await tx.account.create({
                data: {
                  orderIndex,
                  email: email || null,
                  username: username || null,
                  password: password || null,
                  targetFollowers: targetFollowers || 0,
                  currentFollowers: null,
                  accountStatus: null,
                  loginApp: loginApp || null,
                  capital: capital || null,
                  phoneModel: sheetName,
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
        { timeout: 60000 } // 60 second timeout for sync operation
      )

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

        throw new Error(`Instagram account '${username}' tidak ditemukan. ${errorMessage}`)
      }

      if (!data.follower_count) {
        logger.warn(
          `Follower count not found in API response for account ID ${account.id} (${account.username}). Response keys: ${Object.keys(data || {}).join(', ')}`
        )
        throw new Error(data.errorMessage || 'Follower count tidak ditemukan dalam response API')
      }

      const followerCount = parseInt(data.follower_count)

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
      throw error
    }
  },

  async updateGoogleSheetsScanStatus(account: Account & { source?: { spreadsheetId?: string | null } | null }, status: string) {
    if (!account.source?.spreadsheetId || !account.phoneModel) {
      logger.warn(`Cannot update Google Sheets for account ID ${account.id}: missing source, spreadsheet_id, or phone_model`)
      return
    }

    try {
      const { sheets } = await getGoogleSheetsClient()
      const spreadsheetId = account.source.spreadsheetId
      const sheetName = account.phoneModel

      const range = `${sheetName}!A2:F121`
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
        const rowUsername = row[1] ? String(row[1]).trim() : ''

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
              startColumnIndex: 3,
              endColumnIndex: 4,
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
        spreadsheetId,
        requestBody: {
          requests,
        },
      })

      logger.info(`Updated Google Sheets column D with background color (${status}) for account ID ${account.id} in sheet '${sheetName}'`)
    } catch (error) {
      logger.error(`Error updating Google Sheets scan status for account ID ${account.id}: ${error}`)
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
      logger.error(`Error getting sheet ID for '${sheetName}': ${error}`)
      return null
    }
  },

  async getAccountsForScan(sourceId?: string) {
    try {
      let where: Prisma.AccountWhereInput = {
        username: { not: null },
        isSold: false,
      }

      if (sourceId && sourceId !== 'all') {
        where.sourceId = parseInt(sourceId)
      } else {
        // Only scan accounts from non-accsmarket sources
        const nonAccsmarketSources = await prisma.source.findMany({
          where: { isAccsmarket: false },
          select: { id: true },
        })
        where.sourceId = { in: nonAccsmarketSources.map((s) => s.id) }
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

  async searchCustomers(search: string, userRole?: { name?: string }, userSourceId?: number) {
    try {
      let where: Prisma.CustomerWhereInput = {}

      if (userRole?.name === 'admin' && userSourceId) {
        where.sourceId = userSourceId
      }

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
    if (!account.source?.spreadsheetId || !account.phoneModel) {
      logger.warn(`Cannot delete from Google Sheets for account ID ${account.id}: missing source, spreadsheet_id, or phone_model`)
      return
    }

    try {
      const { sheets } = await getGoogleSheetsClient()
      const spreadsheetId = account.source.spreadsheetId
      const sheetName = account.phoneModel

      const range = `${sheetName}!A2:F121`
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
        const rowUsername = row[1] ? String(row[1]).trim() : ''

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

      // Clear A-D columns and set F to Rp0
      const requests = [
        {
          updateCells: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 0,
              endColumnIndex: 4,
            },
            rows: [
              {
                values: [
                  { userEnteredValue: {} },
                  { userEnteredValue: {} },
                  { userEnteredValue: {} },
                  { userEnteredValue: {} },
                ],
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
              startColumnIndex: 3,
              endColumnIndex: 4,
            },
            rows: [
              {
                values: [
                  {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 1.0,
                        green: 1.0,
                        blue: 1.0,
                      },
                    },
                  },
                ],
              },
            ],
            fields: 'userEnteredFormat.backgroundColor',
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
                    userEnteredValue: {
                      stringValue: 'Rp0',
                    },
                  },
                ],
              },
            ],
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
