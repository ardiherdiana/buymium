import { vi } from 'vitest'

// Set test environment variables before any modules load
process.env.JWT_SECRET = 'test-secret-key-for-vitest-suite-only'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test'
process.env.OPENAI_API_KEY = 'test-openai-key-placeholder'
process.env.ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000'

// Shared mock instance that all `new PrismaClient()` calls return
const mockPrismaInstance = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  product: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  stock: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  productSection: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  channel: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  autopostingSchedule: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  autopostingPost: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  role: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  source: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  expense: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  expenseCategory: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  account: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  accsmarket: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  sale: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  saleLine: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  customer: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
  $disconnect: vi.fn(),
}

// Mock PrismaClient so no real DB connection is made
vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    user = mockPrismaInstance.user
    product = mockPrismaInstance.product
    order = mockPrismaInstance.order
    stock = mockPrismaInstance.stock
    productSection = mockPrismaInstance.productSection
    channel = mockPrismaInstance.channel
    autopostingPost = mockPrismaInstance.autopostingPost
    autopostingSchedule = mockPrismaInstance.autopostingSchedule
    role = mockPrismaInstance.role
    source = mockPrismaInstance.source
    expense = mockPrismaInstance.expense
    expenseCategory = mockPrismaInstance.expenseCategory
    account = mockPrismaInstance.account
    accsmarket = mockPrismaInstance.accsmarket
    sale = mockPrismaInstance.sale
    saleLine = mockPrismaInstance.saleLine
    customer = mockPrismaInstance.customer
    $transaction = mockPrismaInstance.$transaction
    $disconnect = mockPrismaInstance.$disconnect
  }

  return {
    PrismaClient: MockPrismaClient,
    Prisma: {
      PrismaClientKnownRequestError: class extends Error {
        code: string
        constructor(message: string, { code }: { code: string }) {
          super(message)
          this.code = code
        }
      },
    },
  }
})

// Mock the db singleton — reuse the same mock instance so tests configure one source of truth
vi.mock('../config/database', () => {
  return {
    default: mockPrismaInstance,
    db: mockPrismaInstance,
  }
})

// Mock services that spin up background jobs
vi.mock('../services/scheduler', () => ({
  startScheduler: vi.fn(),
}))

vi.mock('../services/cleanup', () => ({
  startCleanup: vi.fn(),
}))
