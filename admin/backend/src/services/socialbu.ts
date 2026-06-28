import axios from 'axios'
import fs from 'fs'
import path from 'path'

const SOCIALBU_BASE_URL = 'https://socialbu.com/api/v1'

function getToken(): string {
  const token = process.env.SOCIALBU_ACCESS_TOKEN
  if (!token) throw new Error('SOCIALBU_ACCESS_TOKEN not configured')
  return token
}

function client() {
  return axios.create({
    baseURL: SOCIALBU_BASE_URL,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
}

export async function getAccounts(): Promise<Record<string, unknown>[]> {
  const res = await client().get('/accounts?type=all')
  const raw = res.data
  if (Array.isArray(raw)) return raw
  if (raw?.items && Array.isArray(raw.items)) return raw.items
  if (raw?.data && Array.isArray(raw.data)) return raw.data
  return []
}

export async function uploadMedia(filePath: string): Promise<{ uploadToken: string; url: string }> {
  const fileName = path.basename(filePath)
  const ext = path.extname(fileName).toLowerCase()
  let mimeType = 'image/jpeg'
  if (ext === '.png') mimeType = 'image/png'
  else if (ext === '.mp4' || ext === '.mov') mimeType = 'video/mp4'

  // 1. Initiate upload
  const initRes = await client().post('/upload_media', { name: fileName, mime_type: mimeType })
  const { signed_url, key, url } = initRes.data as { signed_url: string; key: string; url: string }

  // 2. Upload to signed URL — stream file directly (no readFileSync) like the Go implementation
  const fileSize = fs.statSync(filePath).size
  const fileStream = fs.createReadStream(filePath)
  await axios.put(signed_url, fileStream, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': fileSize,
      'x-amz-acl': 'private',
    },
    maxBodyLength: 200 * 1024 * 1024,
    maxContentLength: 200 * 1024 * 1024,
  })

  // 3. Verify status
  const verifyRes = await client().get(`/upload_media/status?key=${key}`)
  const verify = verifyRes.data as { success: boolean; upload_token: string; message?: string }
  if (!verify.success || !verify.upload_token) {
    throw new Error(`SocialBu media processing failed: ${verify.message ?? 'empty upload token'}`)
  }

  return { uploadToken: verify.upload_token, url }
}

export async function createPost(
  content: string,
  accountIds: number[],
  uploadTokens: string[],
  publishAt: string,
  options?: Record<string, unknown>,
): Promise<string> {
  const payload: Record<string, unknown> = {
    content,
    accounts: accountIds,
    publish_at: publishAt,
    draft: false,
  }
  if (uploadTokens.length > 0) {
    payload.existing_attachments = uploadTokens.map((t) => ({ upload_token: t }))
  }
  if (options && Object.keys(options).length > 0) {
    payload.options = options
  }
  const res = await client().post('/posts', payload)
  const result = res.data as { success: boolean; posts?: { id: number }[] }
  if (result.posts && result.posts.length > 0) return String(result.posts[0].id)
  return ''
}

export async function deletePost(sbPostId: string): Promise<void> {
  try {
    await client().delete(`/posts/${sbPostId}`)
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status !== 404) throw err
  }
}
