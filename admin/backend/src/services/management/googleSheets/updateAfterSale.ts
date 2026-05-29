import { sheets_v4 } from 'googleapis'
import { getGoogleSheetsClient } from './client'
import { logger } from '../../../utils/logger'

interface ItemToUpdate {
  id: number
  email?: string | null
  username?: string | null
  phoneModel?: string | null
  year?: string | null
  sourceId?: number | null
  source?: {
    id: number
    spreadsheetId?: string | null
  } | null
  isSold?: boolean
}

interface SheetGroup {
  spreadsheetId: string
  sheetName: string
  items: ItemToUpdate[]
  sheetId?: number
}

/**
 * Update Google Sheets setelah sale dibuat
 * Menghapus/clear data account/accsmarket dari sheets
 * Logika 1-to-1 dari PHP SalesController.php
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

    // Group items by source and sheet name (same as PHP)
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

/**
 * Group items by spreadsheet and sheet name
 * Same logic as PHP: Group by key "spreadsheetId|sheetName"
 */
function groupItemsBySheet(items: ItemToUpdate[]): Record<string, SheetGroup> {
  const grouped: Record<string, SheetGroup> = {}

  for (const item of items) {
    const isAccsmarket = !!item.year // Accsmarket has 'year' field
    const sheetName = isAccsmarket ? item.year : item.phoneModel

    logger.debug(`[GoogleSheets] Grouping item ${item.id}:`, {
      isAccsmarket,
      sheetName,
      email: item.email,
      sourceId: item.sourceId,
    })

    // Validate: must have sheet name
    if (!sheetName) {
      logger.warn(`[GoogleSheets] Skipping item ${item.id} - missing sheet name (phoneModel/year)`)
      continue
    }

    // Validate: Account must have source, Accsmarket can use hardcoded
    if (!isAccsmarket && !item.source) {
      logger.warn(`[GoogleSheets] Skipping Account ${item.id} - missing source`)
      continue
    }

    // Get spreadsheet ID
    const spreadsheetId = isAccsmarket
      ? '1riOQRkG-76-SdlvVw_cxK2igSoTpgcqtBWz_RLztxdg' // Hardcoded for Accsmarket
      : item.source?.spreadsheetId

    // Validate: must have spreadsheet ID
    if (!spreadsheetId) {
      logger.warn(`[GoogleSheets] Skipping item ${item.id} - missing spreadsheetId`, {
        isAccsmarket,
        source: item.source,
      })
      continue
    }

    const key = `${spreadsheetId}|${sheetName}`
    if (!grouped[key]) {
      grouped[key] = {
        spreadsheetId,
        sheetName,
        items: [],
      }
    }

    grouped[key].items.push(item)
  }

  return grouped
}

/**
 * Process a group of items for a specific sheet
 * Same logic as PHP: Read sheet, find rows, send batch requests
 */
async function processSheetGroup(
  service: sheets_v4.Sheets,
  group: SheetGroup
): Promise<void> {
  const { spreadsheetId, sheetName } = group

  try {
    logger.info(`[GoogleSheets] Reading sheet '${sheetName}' from spreadsheet '${spreadsheetId}'`)

    // Read the sheet (A2:H110, same as PHP)
    const range = `'${sheetName}'!A2:H110`
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
      const isAccsmarket = !!item.year

      logger.debug(`[GoogleSheets] Processing item ${item.id} (${isAccsmarket ? 'Accsmarket' : 'Account'})`, {
        email: item.email,
        username: item.username,
      })

      const rowNumber = findRowNumber(values, item, isAccsmarket)

      if (rowNumber === null) {
        logger.warn(
          `[GoogleSheets] Could not find row for ${isAccsmarket ? 'Accsmarket' : 'Account'} ID ${item.id} in sheet '${sheetName}'`,
          {
            email: item.email,
            username: item.username,
            firstRows: values.slice(0, 3),
          }
        )
        continue
      }

      logger.info(`[GoogleSheets] Found matching row ${rowNumber} for item ${item.id}`)

      addUpdateRequests(requests, rowNumber, item, sheetId, isAccsmarket)
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
 * Find row number for item by email or username
 * Same logic as PHP:
 * - Account: username at index 1
 * - Accsmarket: username at index 2
 * - Match if (!empty(email) && email === rowEmail) || (!empty(username) && username === rowUsername)
 */
function findRowNumber(
  values: (string | number | boolean | null)[][],
  item: ItemToUpdate,
  isAccsmarket: boolean
): number | null {
  const usernameIndex = isAccsmarket ? 2 : 1

  const itemEmail = item.email ? item.email.trim() : ''
  const itemUsername = item.username ? item.username.trim() : ''

  logger.debug(`[GoogleSheets] Finding row for item ${item.id}`, {
    isAccsmarket,
    itemEmail,
    itemUsername,
    usernameIndex,
    totalRows: values.length,
  })

  for (let i = 0; i < values.length; i++) {
    const row = values[i]

    // Get email from index 0 (same as PHP)
    const rowEmail = row[0] ? (typeof row[0] === 'string' ? row[0].trim() : '') : ''

    // Get username from index 1 (Account) or 2 (Accsmarket) - same as PHP
    const rowUsername = row[usernameIndex] ? (typeof row[usernameIndex] === 'string' ? row[usernameIndex].trim() : '') : ''

    // Match logic from PHP:
    // if ((!empty($itemEmail) && $rowEmail === $itemEmail) || (!empty($itemUsername) && $rowUsername === $itemUsername))
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
 * Add update requests for Google Sheets
 * Account: Clear A-D, reset color D, set F to "Rp0"
 * Accsmarket: Clear A-F, reset color F, clear G, set H to 0
 */
function addUpdateRequests(
  requests: sheets_v4.Schema$Request[],
  rowNumber: number,
  item: ItemToUpdate,
  sheetId: number,
  isAccsmarket: boolean
): void {
  if (!isAccsmarket) {
    // Account: Clear A-D (indices 0-3)
    requests.push({
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
              { userEnteredValue: {} }, // A
              { userEnteredValue: {} }, // B
              { userEnteredValue: {} }, // C
              { userEnteredValue: {} }, // D
            ],
          },
        ],
        fields: 'userEnteredValue',
      },
    })

    // Account: Reset background color in D (index 3)
    requests.push({
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
    })

    // Account: Set F to "Rp0" (index 5)
    requests.push({
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
    })

    logger.debug(`[GoogleSheets] Added Account update requests for row ${rowNumber}`)
  } else {
    // Accsmarket: Clear A-F (indices 0-5)
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: 0,
          endColumnIndex: 6,
        },
        rows: [
          {
            values: [
              { userEnteredValue: {} }, // A
              { userEnteredValue: {} }, // B
              { userEnteredValue: {} }, // C
              { userEnteredValue: {} }, // D
              { userEnteredValue: {} }, // E
              { userEnteredValue: {} }, // F
            ],
          },
        ],
        fields: 'userEnteredValue',
      },
    })

    // Accsmarket: Reset background in F (index 5)
    requests.push({
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
    })

    // Accsmarket: Clear G (index 6) and set H (index 7) to 0
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: 6,
          endColumnIndex: 8,
        },
        rows: [
          {
            values: [
              { userEnteredValue: {} }, // G: Clear
              { userEnteredValue: { numberValue: 0 } }, // H: Set to 0
            ],
          },
        ],
        fields: 'userEnteredValue',
      },
    })

    logger.debug(`[GoogleSheets] Added Accsmarket update requests for row ${rowNumber}`)
  }
}
