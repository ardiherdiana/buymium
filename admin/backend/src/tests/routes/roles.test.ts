import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockedObject } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { makeAdminToken, makeSuperAdminToken, makeUserToken } from '../helpers'
import { PrismaClient } from '@prisma/client'

// roles.ts uses its own `new PrismaClient()` (imported as `prisma`).
// The mock in setup.ts intercepts every PrismaClient constructor, so we get
// the same shared mock instance here.

const authHeader = `Bearer ${makeAdminToken()}`
const superAdminHeader = `Bearer ${makeSuperAdminToken()}`
const userHeader = `Bearer ${makeUserToken()}`

const mockRole = {
  id: 1,
  name: 'admin',
  description: 'Administrator role',
  permissions: '["*"]',
}

describe('GET /api/roles', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 200 with list of roles (no auth required)', async () => {
    prismaInstance.role.findMany.mockResolvedValueOnce([mockRole])

    const res = await request(app).get('/api/roles')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns empty array when no roles exist', async () => {
    prismaInstance.role.findMany.mockResolvedValueOnce([])

    const res = await request(app).get('/api/roles')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })

  it('returns roles with id, name, description, permissions', async () => {
    prismaInstance.role.findMany.mockResolvedValueOnce([mockRole])

    const res = await request(app).get('/api/roles')

    expect(res.status).toBe(200)
    expect(res.body[0]).toHaveProperty('id')
    expect(res.body[0]).toHaveProperty('name')
    expect(res.body[0]).toHaveProperty('permissions')
  })
})

describe('GET /api/roles/users', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/roles/users')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin role', async () => {
    const res = await request(app)
      .get('/api/roles/users')
      .set('Authorization', userHeader)
    expect(res.status).toBe(403)
  })

  it('returns 200 with paginated users for admin', async () => {
    const mockUserWithRole = {
      id: 1,
      name: 'Admin User',
      email: 'admin@test.com',
      roleId: 1,
      createdAt: new Date(),
      role: { name: 'admin', permissions: '["*"]' },
    }
    prismaInstance.user.findMany.mockResolvedValueOnce([mockUserWithRole])
    prismaInstance.user.count.mockResolvedValueOnce(1)

    const res = await request(app)
      .get('/api/roles/users')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('meta')
    expect(res.body.meta.total).toBe(1)
  })
})

describe('GET /api/roles/users/:userId', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/roles/users/1')
    expect(res.status).toBe(401)
  })

  it('returns 404 when user not found', async () => {
    prismaInstance.user.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .get('/api/roles/users/99999')
      .set('Authorization', authHeader)

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 200 with user role info when found', async () => {
    prismaInstance.user.findUnique.mockResolvedValueOnce({
      id: 1,
      name: 'Admin',
      email: 'admin@test.com',
      roleId: 1,
      createdAt: new Date(),
      role: { name: 'admin', permissions: '["*"]' },
    })

    const res = await request(app)
      .get('/api/roles/users/1')
      .set('Authorization', authHeader)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('role')
    expect(res.body).toHaveProperty('permissions')
  })
})

describe('PATCH /api/roles/users/:userId (superadmin only)', () => {
  let prismaInstance: MockedObject<PrismaClient>

  beforeEach(() => {
    vi.clearAllMocks()
    prismaInstance = new PrismaClient() as MockedObject<PrismaClient>
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/roles/users/1')
      .send({ role: 'admin' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for regular admin', async () => {
    const res = await request(app)
      .patch('/api/roles/users/1')
      .set('Authorization', authHeader)
      .send({ role: 'admin' })
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/superadmin/i)
  })

  it('returns 400 when role name is missing', async () => {
    const res = await request(app)
      .patch('/api/roles/users/1')
      .set('Authorization', superAdminHeader)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/role name is required/i)
  })

  it('returns 400 when role does not exist', async () => {
    prismaInstance.role.findUnique.mockResolvedValueOnce(null)

    const res = await request(app)
      .patch('/api/roles/users/1')
      .set('Authorization', superAdminHeader)
      .send({ role: 'nonexistent' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid role/i)
  })

  it('returns 200 after successful role update', async () => {
    prismaInstance.role.findUnique.mockResolvedValueOnce({ id: 1, name: 'admin' })
    prismaInstance.user.update.mockResolvedValueOnce({
      id: 1,
      name: 'Some User',
      email: 'user@test.com',
      roleId: 1,
      role: { name: 'admin', permissions: '["*"]' },
    })

    const res = await request(app)
      .patch('/api/roles/users/1')
      .set('Authorization', superAdminHeader)
      .send({ role: 'admin' })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/updated successfully/i)
    expect(res.body.user).toHaveProperty('role')
  })
})
