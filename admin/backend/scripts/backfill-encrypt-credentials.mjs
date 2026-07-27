import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()
const ALGO = 'aes-256-gcm'
const ENCRYPTED_RE = /^[0-9a-f]{24}:[0-9a-f]+:[0-9a-f]{32}$/i

function getKey() {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 64) throw new Error('ENCRYPTION_KEY must be a 64-character hex string')
  return Buffer.from(key, 'hex')
}

function encrypt(text) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`
}

function needsEncryption(value) {
  return typeof value === 'string' && value.length > 0 && !ENCRYPTED_RE.test(value)
}

async function backfillAccounts() {
  const rows = await db.account.findMany({ where: { password: { not: null } }, select: { id: true, password: true } })
  let updated = 0
  for (const row of rows) {
    if (!needsEncryption(row.password)) continue
    await db.account.update({ where: { id: row.id }, data: { password: encrypt(row.password) } })
    updated++
  }
  console.log(`accounts: encrypted ${updated}/${rows.length} plaintext passwords`)
}

async function backfillAccsmarkets() {
  const rows = await db.accsmarket.findMany({
    where: { OR: [{ password: { not: null } }, { passwordEmail: { not: null } }, { twoFactorAuth: { not: null } }] },
    select: { id: true, password: true, passwordEmail: true, twoFactorAuth: true },
  })
  let updated = 0
  for (const row of rows) {
    const data = {}
    if (needsEncryption(row.password)) data.password = encrypt(row.password)
    if (needsEncryption(row.passwordEmail)) data.passwordEmail = encrypt(row.passwordEmail)
    if (needsEncryption(row.twoFactorAuth)) data.twoFactorAuth = encrypt(row.twoFactorAuth)
    if (Object.keys(data).length === 0) continue
    await db.accsmarket.update({ where: { id: row.id }, data })
    updated++
  }
  console.log(`accsmarkets: encrypted ${updated}/${rows.length} rows with plaintext fields`)
}

async function main() {
  await backfillAccounts()
  await backfillAccsmarkets()
  await db.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await db.$disconnect()
  process.exit(1)
})
