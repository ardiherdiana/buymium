import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock axios before importing the module
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import axios from 'axios'
import { generateYouTubeShortsCaption } from '../../services/autoposting/ai'

const mockAxios = vi.mocked(axios)

describe('generateYouTubeShortsCaption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-translate-key'
  })

  it('translates a plain filename to Indonesian', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          translations: [{ translatedText: 'Cara Kerja Jahitan' }],
        },
      },
    })

    const result = await generateYouTubeShortsCaption('How Stitches Work.mp4')

    expect(result).toBe('Cara Kerja Jahitan')
    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('translation.googleapis.com'),
      expect.objectContaining({
        q: 'How Stitches Work',
        target: 'id',
        source: 'en',
      }),
      expect.any(Object)
    )
  })

  it('strips the file extension before translating', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { data: { translations: [{ translatedText: 'Cara Memasak Nasi' }] } },
    })

    await generateYouTubeShortsCaption('How To Cook Rice.mp4')

    const callArgs = mockAxios.post.mock.calls[0][1]
    expect(callArgs.q).toBe('How To Cook Rice')
    expect(callArgs.q).not.toContain('.mp4')
  })

  it('strips leading numbering like "#1 " from filename', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { data: { translations: [{ translatedText: 'Cara Menari' }] } },
    })

    await generateYouTubeShortsCaption('#1 How To Dance.mp4')

    const callArgs = mockAxios.post.mock.calls[0][1]
    expect(callArgs.q).toBe('How To Dance')
  })

  it('strips leading "1. " numbering from filename', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { data: { translations: [{ translatedText: 'Cara Berlari' }] } },
    })

    await generateYouTubeShortsCaption('1. How To Run.mp4')

    const callArgs = mockAxios.post.mock.calls[0][1]
    expect(callArgs.q).toBe('How To Run')
  })

  it('returns original filename when cleaned name is empty', async () => {
    // A filename that is just the extension or empty after cleaning
    const result = await generateYouTubeShortsCaption('.mp4')

    // axios should NOT be called when name is empty
    expect(mockAxios.post).not.toHaveBeenCalled()
    expect(result).toBe('.mp4')
  })

  it('returns cleaned name as fallback when translation API returns empty', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { data: { translations: [{ translatedText: '' }] } },
    })

    const result = await generateYouTubeShortsCaption('Cooking Tips.mp4')

    // translatedText is empty — falls back to the cleaned name
    expect(result).toBe('Cooking Tips')
  })

  it('returns cleaned name as fallback when translations array is missing', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { data: {} },
    })

    const result = await generateYouTubeShortsCaption('Travel Vlog.mp4')

    expect(result).toBe('Travel Vlog')
  })

  it('throws when the Google Translate API call fails', async () => {
    mockAxios.post.mockRejectedValueOnce(new Error('Network error'))

    await expect(generateYouTubeShortsCaption('Test Video.mp4')).rejects.toThrow('Network error')
  })

  it('calls the Google Translate API with the correct key param', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { data: { translations: [{ translatedText: 'Resep Kue' }] } },
    })

    await generateYouTubeShortsCaption('Cake Recipe.mp4')

    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        params: { key: 'test-translate-key' },
      })
    )
  })

  it('collapses extra whitespace in the filename before translating', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { data: { translations: [{ translatedText: 'Masak Bersama' }] } },
    })

    await generateYouTubeShortsCaption('Cook  Together.mp4')

    const callArgs = mockAxios.post.mock.calls[0][1]
    expect(callArgs.q).toBe('Cook Together')
  })
})
