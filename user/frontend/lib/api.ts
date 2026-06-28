const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const fetchInit: RequestInit & { next?: { revalidate?: number } } = {
    signal: AbortSignal.timeout(8000),
    ...init,
    next: { revalidate: 60 },
  }
  const res = await fetch(`${BASE_URL}${path}`, fetchInit as RequestInit)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export interface Stats {
  totalListings: number
  totalStock: number
  avgRating: number
}

export interface Product {
  id: number
  title: string
  description: string
  inStock: number
  price: number
  rating: number
  isVerified: boolean
  tags: string[]
}

export interface Testimonial {
  id: number
  buyerName: string
  content: string
  rating: number
  createdAt: string
  product: { id: number; title: string } | null
}
