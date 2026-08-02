import crypto from 'crypto'
import path from 'path'

const DEFAULT_TTL_SECONDS = 5 * 60

function sign(relativePath: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET!)
    .update(`${relativePath}:${expiresAt}`)
    .digest('hex')
}

/** Short-lived signed token for a specific uploads path, so <img> tags can load
 * private files (e.g. payment proof) without an Authorization header. */
export function signFileToken(relativePath: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Date.now() + ttlSeconds * 1000
  const sig = sign(relativePath, expiresAt)
  return `${expiresAt}.${sig}`
}

export function verifyFileToken(relativePath: string, token: string): boolean {
  const [expiresAtStr, sig] = token.split('.')
  const expiresAt = Number(expiresAtStr)
  if (!expiresAt || !sig || Date.now() > expiresAt) return false
  const expectedSig = sign(relativePath, expiresAt)
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Builds the relative API path (with signed token) the client should load the proof image from. */
export function buildProofUrl(paymentProof: string | null | undefined): string | null {
  if (!paymentProof) return null
  const filename = path.basename(paymentProof)
  const token = signFileToken(`payment-proofs/${filename}`)
  return `/api/uploads/payment-proofs/${filename}?token=${token}`
}
