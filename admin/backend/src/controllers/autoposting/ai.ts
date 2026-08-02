import { Request, Response } from 'express'
import axios from 'axios'

export async function generateCaption(req: Request, res: Response) {
  const { filename } = req.body as { filename?: string }
  if (!filename) {
    res.status(400).json({ error: 'filename is required' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'OpenAI API key not configured' })
    return
  }

  const prompt = `Buatkan caption sosial media berdasarkan nama file berikut: '${filename}'.
Aturan wajib:
1. Gunakan Bahasa Indonesia.
2. Gaya bahasa: Datar, tanpa hook/kalimat pancingan, tanpa emoji, tanpa tanda kutip.
3. Format Caption: Title Case (Huruf pertama setiap kata wajib kapital).
4. Format Hashtag: Maksimal 5 hashtag relevan, letakkan di baris baru setelah caption (ada jeda enter).

Contoh Format Output yang HARUS diikuti persis:
Jangan Langsung Salahkan! Bangun Kepercayaan Dulu Sebelum Koreksi Kesalahan
#MembangunKepercayaan #AdabMenasehati #LeadershipTips #KomunikasiEfektif #MentalitasPositif`

  const openaiRes = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates strict format social media captions.' },
        { role: 'user', content: prompt },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
  )

  const choices = openaiRes.data?.choices
  if (!choices || choices.length === 0) {
    res.status(500).json({ error: 'No caption generated' })
    return
  }

  res.json({ caption: choices[0].message.content })
}
