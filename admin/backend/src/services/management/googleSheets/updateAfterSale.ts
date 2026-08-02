import { sheets_v4 } from 'googleapis'
import { getGoogleSheetsClient } from './client'
import { logger } from '../../../utils/logger'
import { SHEET_SCAN_RANGE, STATUS_COLUMN_INDEX } from './sheetColumns'

interface ItemToUpdate {
  id: number
  email?: string | null
  username?: string | null
  sourceSheetName?: string | null
  source?: { id: number; spreadsheetId?: string | null } | null
  isSold?: boolean
}

interface SheetGroup {
  spreadsheetId: string
  sheetName: string
  items: ItemToUpdate[]
}

/**
 * Update Google Sheets after a sale is created — clears the sold account's row
 * from its source sheet, grouped by each item's own Source spreadsheet.
 */
export async function updateGoogleSheetsAfterSale(items: ItemToUpdate[]): Promise<void> {
  if (!items || items.length === 0) {
    logger.info('[GoogleSheets] No items to update')
    return
  }

  logger.info(`[GoogleSheets] Starting update for ${items.length} items`)

  try {
    const { sheets } = await getGoogleSheetsClient()
    logger.info('[GoogleSheets] Client initialized')

    const groupedBySheet = groupItemsBySheet(items)
    logger.info(`[GoogleSheets] Grouped into ${Object.keys(groupedBySheet).length} sheets`)

    for (const group of Object.values(groupedBySheet)) {
      logger.info(`[GoogleSheets] Processing sheet: ${group.sheetName} (${group.items.length} items)`)
      await processSheetGroup(sheets, group)
    }

    logger.info('[GoogleSheets] Update completed successfully')
  } catch (error) {
    logger.error('Error updating Google Sheets after sale:', error)
  }
}

function groupItemsBySheet(items: ItemToUpdate[]): Record<string, SheetGroup> {
  const grouped: Record<string, SheetGroup> = {}

  for (const item of items) {
    const sheetName = item.sourceSheetName
    const spreadsheetId = item.source?.spreadsheetId

    if (!sheetName) {
      logger.warn(`[GoogleSheets] Skipping item ${item.id} - missing sheet name (sourceSheetName)`)
      continue
    }

    if (!spreadsheetId) {
      logger.warn(`[GoogleSheets] Skipping item ${item.id} - missing spreadsheetId`, { source: item.source })
      continue
    }

    const key = `${spreadsheetId}|${sheetName}`
    if (!grouped[key]) {
      grouped[key] = { spreadsheetId, sheetName, items: [] }
    }

    grouped[key].items.push(item)
  }

  return grouped
}

/**
 * Process a group of items for a specific sheet: read the sheet, find rows, send batch requests.
 */
async function processSheetGroup(
  service: sheets_v4.Sheets,
  group: SheetGroup
): Promise<void> {
  const { spreadsheetId, sheetName } = group

  try {
    logger.info(`[GoogleSheets] Reading sheet '${sheetName}' from spreadsheet '${spreadsheetId}'`)

    const range = `'${sheetName}'!${SHEET_SCAN_RANGE}`
    const response = await service.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    const values = response.data.values || []

    if (!values || values.length === 0) {
      logger.warn(`[GoogleSheets] Sheet '${sheetName}' is empty`)
      return
    }

    logger.info(`[GoogleSheets] Read ${values.length} rows from sheet '${sheetName}'`)

    // Get sheet ID for batch update
    const spreadsheet = await service.spreadsheets.get({
      spreadsheetId,
    })

    let sheetId: number | null = null
    const sheets = spreadsheet.data.sheets || []
    for (const sheet of sheets) {
      if (sheet.properties?.title === sheetName) {
        sheetId = sheet.properties.sheetId ?? null
        break
      }
    }

    if (sheetId === null) {
      logger.warn(`[GoogleSheets] Could not find sheet '${sheetName}' in spreadsheet '${spreadsheetId}'`)
      return
    }

    logger.info(`[GoogleSheets] Found sheet ID: ${sheetId}`)

    // Find rows and prepare requests
    const requests: sheets_v4.Schema$Request[] = []

    for (const item of group.items) {
      logger.debug(`[GoogleSheets] Processing item ${item.id}`, {
        email: item.email,
        username: item.username,
      })

      const rowNumber = findRowNumber(values, item)

      if (rowNumber === null) {
        logger.warn(
          `[GoogleSheets] Could not find row for item ${item.id} in sheet '${sheetName}'`,
          {
            email: item.email,
            username: item.username,
            firstRows: values.slice(0, 3),
          }
        )
        continue
      }

      logger.info(`[GoogleSheets] Found matching row ${rowNumber} for item ${item.id}`)

      addUpdateRequests(requests, rowNumber, sheetId)
    }

    // Batch execute requests
    if (requests.length > 0) {
      logger.info(`[GoogleSheets] Executing ${requests.length} requests for sheet '${sheetName}'`)
      await service.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      })
      logger.info(`[GoogleSheets] Successfully updated Google Sheets for sheet '${sheetName}'`)
    } else {
      logger.warn(`[GoogleSheets] No requests to execute for sheet '${sheetName}'`)
    }
  } catch (error) {
    logger.error(`[GoogleSheets] Error processing sheet '${sheetName}':`, error)
  }
}

/**
 * Find row number for item by email or username.
 * Unified column layout: Email(0), Password Email(1), Username(2), Password(3), ...
 */
function findRowNumber(
  values: (string | number | boolean | null)[][],
  item: ItemToUpdate
): number | null {
  const usernameIndex = 2

  const itemEmail = item.email ? item.email.trim() : ''
  const itemUsername = item.username ? item.username.trim() : ''

  logger.debug(`[GoogleSheets] Finding row for item ${item.id}`, {
    itemEmail,
    itemUsername,
    usernameIndex,
    totalRows: values.length,
  })

  for (let i = 0; i < values.length; i++) {
    const row = values[i]

    const rowEmail = row[0] ? (typeof row[0] === 'string' ? row[0].trim() : '') : ''
    const rowUsername = row[usernameIndex] ? (typeof row[usernameIndex] === 'string' ? row[usernameIndex].trim() : '') : ''

    const emailMatch = itemEmail && rowEmail === itemEmail
    const usernameMatch = itemUsername && rowUsername === itemUsername

    if (emailMatch || usernameMatch) {
      const foundRow = i + 2 // +2 for 1-based index and header row
      logger.debug(`[GoogleSheets] Found matching row ${foundRow}`, {
        emailMatch,
        usernameMatch,
        itemEmail,
        itemUsername,
        rowEmail,
        rowUsername,
      })
      return foundRow
    }
  }

  logger.warn(`[GoogleSheets] No row found for item ${item.id}`, {
    itemEmail,
    itemUsername,
    usernameIndex,
    firstRows: values.slice(0, 3).map((r, i) => ({
      rowIndex: i,
      email: r[0],
      username: r[usernameIndex],
    })),
  })

  return null
}

/**
 * Add update requests for Google Sheets, using the unified column layout:
 * Email(0), Password Email(1), Username(2), Password(3), 2FA(4), Tahun Dibuat(5),
 * Target Followers(6, status column), Hp(7), Aplikasi(8), Modal(9)
 */
function addUpdateRequests(
  requests: sheets_v4.Schema$Request[],
  rowNumber: number,
  sheetId: number
): void {
  const clearColumns = (startColumnIndex: number, count: number) => {
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex, endColumnIndex: startColumnIndex + count },
        rows: [{ values: Array.from({ length: count }, () => ({ userEnteredValue: {} })) }],
        fields: 'userEnteredValue',
      },
    })
  }

  clearColumns(0, STATUS_COLUMN_INDEX) // Email, Password Email, Username, Password, 2FA, Tahun Dibuat

  requests.push({
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
              userEnteredValue: {},
              userEnteredFormat: { backgroundColor: { red: 1.0, green: 1.0, blue: 1.0 } },
            },
          ],
        },
      ],
      fields: 'userEnteredValue,userEnteredFormat.backgroundColor',
    },
  })

  clearColumns(7, 2) // Hp, Aplikasi

  requests.push({
    updateCells: {
      range: { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 9, endColumnIndex: 10 },
      rows: [{ values: [{ userEnteredValue: { stringValue: 'Rp0' } }] }],
      fields: 'userEnteredValue',
    },
  })

  logger.debug(`[GoogleSheets] Added update requests for row ${rowNumber}`)
}
