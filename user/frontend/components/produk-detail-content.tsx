"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ShieldCheck,
  Star,
  Package,
  ShoppingCart,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  User,
  ImageOff,
  Users,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { resolveImageUrl, type Product, type Testimonial } from "@/lib/api"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
const PAGE_SIZE = 10

interface StockPreview {
  id: number
  username: string | null
  emailDomain: string | null
  hasTwoFactor: boolean
  targetFollowers: number | null
  year: string | null
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`size-3.5 ${s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  )
}

export function ProdukDetailContent({ hasBottomNav = false }: { hasBottomNav?: boolean }) {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const router = useRouter()

  const [product, setProduct] = useState<Product | null>(null)
  const [stocks, setStocks] = useState<StockPreview[]>([])
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [buying, setBuying] = useState(false)
  const [page, setPage] = useState(1)
  // Keyed by variantId (or "none" for products without variants) so switching
  // between follower tiers doesn't clear what was already checked elsewhere.
  const [selectedByVariant, setSelectedByVariant] = useState<Record<string, Set<number>>>({})
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)

  const variantKey = String(selectedVariantId ?? "none")
  const selected = selectedByVariant[variantKey] ?? new Set<number>()

  useEffect(() => {
    fetch(`${API_BASE}/products/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then((d) => {
        if (!d) return
        setProduct(d)
        const variants: { id: number; targetFollowers: number | null }[] = d.variants ?? []
        if (variants.length > 0) {
          const smallest = variants.reduce((min: typeof variants[number], v: typeof variants[number]) =>
            (v.targetFollowers ?? Infinity) < (min.targetFollowers ?? Infinity) ? v : min
          )
          setSelectedVariantId(smallest.id)
        }

        fetch(`${API_BASE}/testimonials?productId=${d.id}&limit=20`)
          .then((r) => r.json())
          .then((t) => setTestimonials(Array.isArray(t) ? t : []))
          .catch(() => {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch(`${API_BASE}/products/${id}/stocks`)
      .then((r) => r.json())
      .then((d) => setStocks(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [id])

  function toggleStock(stockId: number) {
    setSelectedByVariant((prev) => {
      const next = new Set(prev[variantKey] ?? [])
      if (next.has(stockId)) next.delete(stockId)
      else next.add(stockId)
      return { ...prev, [variantKey]: next }
    })
  }

  function togglePageAll() {
    const pageIds = pagedStocks.map((s) => s.id)
    const allChecked = pageIds.every((sid) => selected.has(sid))
    setSelectedByVariant((prev) => {
      const next = new Set(prev[variantKey] ?? [])
      if (allChecked) pageIds.forEach((sid) => next.delete(sid))
      else pageIds.forEach((sid) => next.add(sid))
      return { ...prev, [variantKey]: next }
    })
  }

  function selectVariant(variantId: number | null) {
    setSelectedVariantId(variantId)
    setPage(1)
  }

  async function submitOrder(authToken: string) {
    if (!product) return
    setBuying(true)
    try {
      const entries = Object.entries(selectedByVariant).filter(([, ids]) => ids.size > 0)

      let res: Response
      if (entries.length > 1) {
        const items = entries.map(([key, ids]) => ({
          productId: product.id,
          quantity: ids.size,
          variantId: key === "none" ? undefined : Number(key),
          stockIds: Array.from(ids),
        }))
        res = await fetch(`${API_BASE}/orders/cart`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ items }),
        })
      } else {
        const [key, ids] = entries[0] ?? [variantKey, selected]
        const quantity = ids.size > 0 ? ids.size : 1
        const stockIds = ids.size > 0 ? Array.from(ids) : undefined
        const variantId = key === "none" ? undefined : Number(key)
        res = await fetch(`${API_BASE}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ productId: product.id, quantity, variantId, stockIds }),
        })
      }
      if (res.ok) {
        const data = await res.json()
        router.push(`/dashboard/pesanan/${data.orderId ?? data.firstOrderId ?? ""}`)
      }
    } finally {
      setBuying(false)
    }
  }

  function handleBuy() {
    if (!product) return
    if (!token) {
      router.push(`/masuk?redirect=/produk/${id}`)
      return
    }
    submitOrder(token)
  }

  if (loading) {
    return (
      <div className="w-full space-y-4 pb-32">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (notFound || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="mb-4 size-14 text-muted-foreground/40" />
        <h2 className="text-lg font-semibold">Produk tidak ditemukan</h2>
        <p className="mt-1 text-sm text-muted-foreground">Produk ini mungkin sudah tidak tersedia.</p>
        <Button className="mt-4" variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          Kembali
        </Button>
      </div>
    )
  }

  const variants = product.variants ?? []
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null

  const filteredStocks = selectedVariant
    ? stocks.filter((s) => s.targetFollowers === selectedVariant.targetFollowers)
    : stocks
  const totalPages = Math.ceil(filteredStocks.length / PAGE_SIZE)
  const pagedStocks = filteredStocks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageAllChecked = pagedStocks.length > 0 && pagedStocks.every((s) => selected.has(s.id))
  const pageIndeterminate = !pageAllChecked && pagedStocks.some((s) => selected.has(s.id))

  const selectedCount = selected.size
  const unitPrice = selectedVariant ? selectedVariant.price : product.price
  const availableForDisplay = selectedVariant ? selectedVariant.availableStock : product.inStock

  // Grand total across every variant tab that has checked accounts, not just the
  // one currently in view - selections persist when switching tiers.
  const priceForKey = (key: string) => key === "none" ? product.price : (variants.find((v) => v.id === Number(key))?.price ?? product.price)
  const totalSelectedCount = Object.values(selectedByVariant).reduce((s, ids) => s + ids.size, 0)
  const totalSelectedPrice = Object.entries(selectedByVariant).reduce((s, [key, ids]) => s + priceForKey(key) * ids.size, 0)
  const totalPrice = totalSelectedCount > 0 ? totalSelectedPrice : unitPrice

  const priceRange = variants.length > 0
    ? { min: Math.min(...variants.map((v) => v.price)), max: Math.max(...variants.map((v) => v.price)) }
    : null
  const needsVariantSelection = variants.length > 0 && !selectedVariant

  return (
    <div className="w-full">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Kembali
      </button>

      <div className="space-y-4">
        {/* Photo + title/description side by side */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="aspect-square w-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center sm:w-64">
            {resolveImageUrl(product.imageUrl) ? (
              <img
                src={resolveImageUrl(product.imageUrl)!}
                alt={product.title}
                className="size-full object-cover"
              />
            ) : (
              <ImageOff className="size-10 text-muted-foreground/50" />
            )}
          </div>

          <div className="flex-1 space-y-4">
            {/* Title */}
            <div>
              <div className="mb-2 flex items-start gap-3">
                <h1 className="text-2xl font-bold leading-snug">{product.title}</h1>
                {product.isVerified && (
                  <span className="mt-1 flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <ShieldCheck className="size-3" />
                    Terverifikasi
                  </span>
                )}
              </div>
              {product.rating > 0 && (
                <div className="flex items-center gap-1.5">
                  <StarRating rating={product.rating} />
                  {product.soldCount > 0 && (
                    <span className="text-sm text-muted-foreground">· {product.soldCount} terjual</span>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-2 font-semibold">Deskripsi Produk</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {product.description || "Tidak ada deskripsi."}
              </p>
            </div>
          </div>
        </div>

        {/* Follower-tier filter tabs */}
        {variants.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {variants.map((v) => {
              const isActive = v.id === selectedVariantId
              return (
                <button
                  key={v.id}
                  onClick={() => selectVariant(isActive ? null : v.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <Users className="size-3.5" />
                  {v.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Account list with checkboxes */}
        {filteredStocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-center">
            <Package className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">Stok tidak tersedia</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedVariant ? "Belum ada akun untuk tingkatan followers ini." : "Belum ada akun tersedia untuk produk ini."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={pageAllChecked}
                  data-state={pageIndeterminate ? "indeterminate" : pageAllChecked ? "checked" : "unchecked"}
                  onCheckedChange={togglePageAll}
                  aria-label="Pilih semua di halaman ini"
                />
                <h2 className="font-semibold">Preview Akun</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {selectedCount > 0 ? (
                  <span className="text-primary font-medium">{selectedCount} dipilih</span>
                ) : (
                  `${filteredStocks.length} akun tersedia`
                )}
              </span>
            </div>

            <div className="divide-y divide-border">
              {pagedStocks.map((stock, i) => (
                <label
                  key={stock.id}
                  className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-muted/30 sm:flex-nowrap sm:px-5"
                >
                  <Checkbox
                    checked={selected.has(stock.id)}
                    onCheckedChange={() => toggleStock(stock.id)}
                  />
                  <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <User className="size-3 shrink-0 text-muted-foreground hidden sm:block" />
                    {stock.username ? (
                      <a
                        href={`https://instagram.com/${stock.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-0 flex-1 truncate text-sm hover:text-primary hover:underline"
                      >
                        {stock.username}
                        {stock.year && <span className="ml-1 text-xs text-muted-foreground">({stock.year})</span>}
                      </a>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm">—</span>
                    )}
                  </div>
                  <div className="ml-8 flex flex-wrap items-center gap-1.5 sm:ml-0 sm:contents">
                    {stock.targetFollowers != null && (
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <Users className="size-3 hidden sm:block" />
                        {stock.targetFollowers.toLocaleString("id-ID")}+
                        <span className="hidden sm:inline"> Followers</span>
                      </span>
                    )}
                    {stock.hasTwoFactor && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <KeyRound className="size-3" />
                        2FA
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <span className="text-xs text-muted-foreground">
                  Halaman {page} dari {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Testimoni pembeli */}
        {testimonials.length > 0 && (
          <div>
            <h2 className="mb-3 font-semibold">Testimoni Pembeli</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {testimonials.map((t) => (
                <Card key={t.id}>
                  <CardContent>
                    <div className="mb-2 flex items-center gap-3">
                      <Avatar size="sm">
                        {t.avatar && <AvatarImage src={t.avatar} alt={t.customerName} />}
                        <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                          {t.customerName ? t.customerName[0].toUpperCase() : "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{t.customerName}</p>
                        <StarRating rating={t.rating} />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{t.message}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom bar - offset above the mobile bottom nav when rendered inside the dashboard */}
      <div
        className={`sticky z-40 mt-6 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-t-xl sm:border sm:px-5 ${
          hasBottomNav ? "bottom-14 md:bottom-0" : "bottom-0"
        }`}
      >
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {totalSelectedCount > 0 ? `${totalSelectedCount} akun dipilih` : "Harga per akun"}
            </p>
            <p className="truncate text-lg font-bold sm:text-xl">
              {needsVariantSelection && priceRange && totalSelectedCount === 0 ? (
                priceRange.min === priceRange.max
                  ? `Rp ${priceRange.min.toLocaleString("id")}`
                  : `Rp ${priceRange.min.toLocaleString("id")} - Rp ${priceRange.max.toLocaleString("id")}`
              ) : unitPrice > 0 ? (
                `Rp ${totalPrice.toLocaleString("id")}`
              ) : (
                "Hubungi kami"
              )}
            </p>
          </div>

          {needsVariantSelection && totalSelectedCount === 0 ? (
            <Button size="lg" disabled variant="outline" className="shrink-0">
              Pilih tingkatan dulu
            </Button>
          ) : availableForDisplay > 0 || totalSelectedCount > 0 ? (
            <Button size="lg" onClick={handleBuy} disabled={buying} className="shrink-0">
              <ShoppingCart className="size-4" />
              {buying ? "Memproses..." : totalSelectedCount > 0 ? `Beli ${totalSelectedCount} Akun` : "Beli Sekarang"}
            </Button>
          ) : (
            <Button size="lg" disabled variant="outline" className="shrink-0">
              Stok Habis
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
