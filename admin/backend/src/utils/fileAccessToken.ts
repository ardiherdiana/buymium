import crypto from 'crypto'
import path from 'path'

const DEFAULT_TTL_SECONDS = 5 * 60

// Mirrors user/backend/src/utils/fileAccessToken.ts — both apps share JWT_SECRET,
// so a token signed here is verifiable by user/backend's uploads route and vice versa.
function sign(relativePath: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET!)
    .update(`${relativePath}:${expiresAt}`)
    .digest('hex')
}

function signFileToken(relativePath: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Date.now() + ttlSeconds * 1000
  return `${expiresAt}.${sign(relativePath, expiresAt)}`
}

/** Builds the relative path (with signed token) an admin frontend <img> should load a
 * customer's payment proof from — the file only lives on user/backend's disk. */
export function buildProofUrl(paymentProof: string | null | undefined): string | null {
  if (!paymentProof) return null
  const filename = path.basename(paymentProof)
  const token = signFileToken(`payment-proofs/${filename}`)
  return `/api/uploads/payment-proofs/${filename}?token=${token}`
}
