// Unified column layout used by every sheet tab in the shared spreadsheet:
// Email | Password Email | Username | Password | 2FA | Tahun Dibuat | Target Followers | Hp | Aplikasi | Modal
export interface SheetColumnIndices {
  email: number
  passwordEmail: number
  username: number
  password: number
  twoFa: number
  year: number
  targetFollowers: number
  hp: number
  aplikasi: number
  capital: number
}

// Column the sync/scan status background color is written to (Target Followers).
export const STATUS_COLUMN_INDEX = 6

export const SHEET_HEADER_RANGE = 'A1:J1'
export const SHEET_DATA_RANGE = 'A2:J500'
export const SHEET_SCAN_RANGE = 'A2:J500'

const DEFAULT_COLUMN_INDICES: SheetColumnIndices = {
  email: 0,
  passwordEmail: 1,
  username: 2,
  password: 3,
  twoFa: 4,
  year: 5,
  targetFollowers: 6,
  hp: 7,
  aplikasi: 8,
  capital: 9,
}

export function detectSheetColumns(headerRow: (string | number | boolean | null)[]): SheetColumnIndices {
  const idx: SheetColumnIndices = {
    email: -1,
    passwordEmail: -1,
    username: -1,
    password: -1,
    twoFa: -1,
    year: -1,
    targetFollowers: -1,
    hp: -1,
    aplikasi: -1,
    capital: -1,
  }

  headerRow.forEach((header, index) => {
    const h = String(header ?? '').toLowerCase().trim()
    if (h.includes('password email')) idx.passwordEmail = index
    else if (h.includes('email')) idx.email = index
    else if (h.includes('username')) idx.username = index
    else if (h.includes('2fa') || h.includes('auth')) idx.twoFa = index
    else if (h.includes('password')) idx.password = index
    else if (h.includes('tahun')) idx.year = index
    else if (h.includes('target') && h.includes('follower')) idx.targetFollowers = index
    else if (h === 'hp') idx.hp = index
    else if (h.includes('aplikasi')) idx.aplikasi = index
    else if (h.includes('modal')) idx.capital = index
  })

  // Header row missing/unrecognized — fall back to the fixed unified column order.
  if (idx.email === -1 && idx.username === -1) {
    return { ...DEFAULT_COLUMN_INDICES }
  }

  return idx
}

export function parseCapital(raw: string | number | boolean | null): number | null {
  if (raw === null || raw === undefined || !String(raw).trim()) return null

  let capitalValue = String(raw).trim().replace(/Rp\s*/i, '').replace(/[^\d.,]/g, '')

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

  return capitalValue ? parseFloat(capitalValue) : null
}
