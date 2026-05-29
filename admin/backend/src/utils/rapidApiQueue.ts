const MAX_RETRIES = 3

export async function enqueueRapidApiCall<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429 && attempt < MAX_RETRIES - 1) {
        const delay = (attempt + 1) * 10000 // 10s, 20s
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}
