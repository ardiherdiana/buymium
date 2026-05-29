import { vi, beforeEach } from 'vitest'

// Set env vars before any module is imported
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-minimum-32-chars'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.MIDTRANS_SERVER_KEY = 'test-midtrans-server-key'
process.env.MIDTRANS_CLIENT_KEY = 'test-midtrans-client-key'
process.env.FRONTEND_URL = 'http://localhost:3000'

// Mock Prisma
export const mockDb = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  product: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  stock: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  productSection: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('../config/database', () => ({ default: mockDb }))

vi.mock('midtrans-client', () => {
  const mockSnapInstance = {
    createTransaction: vi.fn().mockResolvedValue({
      token: 'snap-token',
      redirect_url: 'https://pay.url',
    }),
    transaction: {
      notification: vi.fn().mockResolvedValue({
        order_id: 'BUYMIUM-1-123',
        transaction_status: 'settlement',
        fraud_status: 'accept',
        payment_type: 'bank_transfer',
      }),
      status: vi.fn().mockResolvedValue({
        transaction_status: 'settlement',
        fraud_status: 'accept',
        payment_type: 'bank_transfer',
      }),
    },
  }
  class MockSnap {
    createTransaction = mockSnapInstance.createTransaction
    transaction = mockSnapInstance.transaction
  }
  return { default: { Snap: MockSnap } }
})

vi.mock('google-auth-library', () => {
  const mockVerifyIdToken = vi.fn().mockResolvedValue({
    getPayload: () => ({
      sub: 'google-id-123',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: 'https://pic.url/photo.jpg',
    }),
  })
  class MockOAuth2Client {
    verifyIdToken = mockVerifyIdToken
  }
  return { OAuth2Client: MockOAuth2Client }
})

// Mock security-logger to avoid file I/O during tests
vi.mock('../utils/securityLogger', () => ({
  securityLogger: {
    loginFailed: vi.fn(),
    loginSuccess: vi.fn(),
    unauthorized: vi.fn(),
    forbidden: vi.fn(),
    rateLimitHit: vi.fn(),
  },
}))

beforeEach(() => {
  // Clear call history and queued once-values before each test
  vi.clearAllMocks()
  // Drain any queued mockResolvedValueOnce/mockReturnValueOnce chains
  // by resetting the implementations back to returning undefined
  Object.values(mockDb).forEach(model => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach(fn => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as ReturnType<typeof vi.fn>).mockReset()
        }
      })
    }
  })
})
