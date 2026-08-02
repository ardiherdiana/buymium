import 'dotenv/config'
import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey() {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 64) throw new Error('ENCRYPTION_KEY must be a 64-character hex string')
  return Buffer.from(key, 'hex')
}

function decrypt(payload) {
  const [ivHex, encHex, tagHex] = payload.split(':')
  if (!ivHex || !encHex || !tagHex) throw new Error('Invalid encrypted payload')
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8')
}

const payload = process.argv[2]
if (!payload) {
  console.error('Usage: node scripts/decrypt.mjs "iv_hex:enc_hex:tag_hex"')
  process.exit(1)
}

console.log(decrypt(payload))
