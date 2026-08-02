import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'.slice(0, 64)
})

describe('encrypt/decrypt', () => {
  it('round-trips plaintext through encrypt then decrypt', async () => {
    const { encrypt, decrypt } = await import('../../utils/encrypt')
    const plaintext = 'super-secret-account-credential'
    const ciphertext = encrypt(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it('produces different ciphertext for the same plaintext (random IV)', async () => {
    const { encrypt } = await import('../../utils/encrypt')
    const a = encrypt('same-value')
    const b = encrypt('same-value')
    expect(a).not.toBe(b)
  })

  it('produces payload in iv:enc:tag hex format', async () => {
    const { encrypt } = await import('../../utils/encrypt')
    const ciphertext = encrypt('hello')
    const parts = ciphertext.split(':')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/i)
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/i)
  })

  it('decrypt throws on malformed payload', async () => {
    const { decrypt } = await import('../../utils/encrypt')
    expect(() => decrypt('not-a-valid-payload')).toThrow('Invalid encrypted payload')
  })

  it('decrypt throws when auth tag/ciphertext is corrupted', async () => {
    const { encrypt, decrypt } = await import('../../utils/encrypt')
    const ciphertext = encrypt('hello world')
    const [iv, enc, tag] = ciphertext.split(':')
    const corrupted = `${iv}:${enc.slice(0, -2)}ff:${tag}`
    expect(() => decrypt(corrupted)).toThrow()
  })
})

describe('safeDecrypt', () => {
  it('returns null for null input', async () => {
    const { safeDecrypt } = await import('../../utils/encrypt')
    expect(safeDecrypt(null)).toBeNull()
  })

  it('returns null for undefined input', async () => {
    const { safeDecrypt } = await import('../../utils/encrypt')
    expect(safeDecrypt(undefined)).toBeNull()
  })

  it('returns empty string unchanged for empty string input', async () => {
    const { safeDecrypt } = await import('../../utils/encrypt')
    expect(safeDecrypt('')).toBe('')
  })

  it('decrypts a valid encrypted value', async () => {
    const { encrypt, safeDecrypt } = await import('../../utils/encrypt')
    const ciphertext = encrypt('my-plaintext-value')
    expect(safeDecrypt(ciphertext)).toBe('my-plaintext-value')
  })

  it('returns the original value unchanged when it does not look encrypted', async () => {
    const { safeDecrypt } = await import('../../utils/encrypt')
    expect(safeDecrypt('plainUsername123')).toBe('plainUsername123')
  })

  it('returns the raw value instead of throwing when format matches but content is corrupted', async () => {
    const { encrypt, safeDecrypt } = await import('../../utils/encrypt')
    const ciphertext = encrypt('hello world')
    const [iv, enc, tag] = ciphertext.split(':')
    const corrupted = `${iv}:${enc.slice(0, -2)}ff:${tag}`
    expect(() => safeDecrypt(corrupted)).not.toThrow()
    expect(safeDecrypt(corrupted)).toBe(corrupted)
  })
})
