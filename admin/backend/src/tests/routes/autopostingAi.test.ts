import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { makeAdminToken, makeUserToken } from '../helpers'

vi.mock('axios')

import axios from 'axios'

const mockAxios = vi.mocked(axios, true)
const authHeader = `Bearer ${makeAdminToken()}`

describe('POST /api/autoposting/ai/caption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/autoposting/ai/caption')
      .send({ filename: 'test.mp4' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await request(app)
      .post('/api/autoposting/ai/caption')
      .set('Authorization', `Bearer ${makeUserToken()}`)
      .send({ filename: 'test.mp4' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when filename is missing', async () => {
    const res = await request(app)
      .post('/api/autoposting/ai/caption')
      .set('Authorization', authHeader)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/filename/i)
  })

  it('returns the generated caption on success', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'Generated Caption Text' } }] },
    })

    const res = await request(app)
      .post('/api/autoposting/ai/caption')
      .set('Authorization', authHeader)
      .send({ filename: 'my-video.mp4' })

    expect(res.status).toBe(200)
    expect(res.body.caption).toBe('Generated Caption Text')
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ model: 'gpt-4o' }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }) })
    )
  })

  it('returns 500 when OpenAI returns no choices', async () => {
    mockAxios.post.mockResolvedValueOnce({ data: { choices: [] } })

    const res = await request(app)
      .post('/api/autoposting/ai/caption')
      .set('Authorization', authHeader)
      .send({ filename: 'my-video.mp4' })

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/no caption/i)
  })
})
