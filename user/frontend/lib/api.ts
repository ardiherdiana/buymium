const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"

const UPLOADS_BASE_URL = process.env.NEXT_PUBLIC_UPLOADS_URL ?? "https://admin.buymium.store"

export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null
  if (/^https?:\/\//.test(url)) return url
  return `${UPLOADS_BASE_URL}${url}`
}

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

export interface ProductVariant {
  id: number
  name: string
  price: number
  targetFollowers: number | null
  availableStock: number
}

export interface Product {
  id: number
  slug?: string
  title: string
  description: string
  inStock: number
  price: number
  rating: number
  soldCount: number
  isVerified: boolean
  imageUrl?: string | null
  variants?: ProductVariant[]
}

export interface Testimonial {
  id: number
  customerName: string
  message: string
  rating: number
  avatar?: string | null
  createdAt: string
  product: { id: number; title: string } | null
}
