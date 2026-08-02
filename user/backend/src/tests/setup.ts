import { vi, beforeEach } from 'vitest'

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-minimum-32-chars'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.FRONTEND_URL = 'http://localhost:3000'

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
    groupBy: vi.fn(),
  },
  productSection: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  productVariant: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  account: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  testimonial: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  bankAccount: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  otpToken: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  accountAccessLog: {
    count: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}

vi.mock('../config/database', () => ({ default: mockDb }))

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
  vi.clearAllMocks()
  Object.values(mockDb).forEach(model => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach(fn => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as ReturnType<typeof vi.fn>).mockReset()
        }
      })
    }
  })
  mockDb.productVariant.findMany.mockResolvedValue([])
  mockDb.testimonial.aggregate.mockResolvedValue({ _avg: { rating: null } })
  mockDb.order.aggregate.mockResolvedValue({ _sum: { quantity: null } })
  mockDb.testimonial.groupBy.mockResolvedValue([])
  mockDb.order.groupBy.mockResolvedValue([])
  mockDb.$transaction.mockImplementation((cb: unknown) => typeof cb === 'function' ? (cb as (tx: typeof mockDb) => unknown)(mockDb) : Promise.all(cb as Promise<unknown>[]))
  mockDb.$queryRaw.mockResolvedValue([])
  mockDb.$executeRaw.mockResolvedValue(0)
})
