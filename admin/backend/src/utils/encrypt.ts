import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`
}

export function decrypt(payload: string): string {
  const [ivHex, encHex, tagHex] = payload.split(':')
  if (!ivHex || !encHex || !tagHex) throw new Error('Invalid encrypted payload')
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8')
}

// Handles legacy plaintext values that haven't been migrated yet
export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return value ?? null
  if (/^[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$/i.test(value)) {
    try { return decrypt(value) } catch { return value }
  }
  return value
}
