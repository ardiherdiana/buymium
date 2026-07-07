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
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { resolveImageUrl, type Product } from "@/lib/api"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
const PAGE_SIZE = 10

interface StockPreview {
  id: number
  username: string | null
  emailDomain: string | null
  hasTwoFactor: boolean
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

export default function DashboardProdukPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const { open: sidebarOpen } = useSidebar()
  const router = useRouter()

  const [product, setProduct] = useState<Product | null>(null)
  const [stocks, setStocks] = useState<StockPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [buying, setBuying] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch(`${API_BASE}/products/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then((d) => { if (d) setProduct(d) })
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch(`${API_BASE}/products/${id}/stocks`)
      .then((r) => r.json())
      .then((d) => setStocks(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [id])

  function toggleStock(stockId: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(stockId)) next.delete(stockId)
      else next.add(stockId)
      return next
    })
  }

  function togglePageAll() {
    const pageIds = pagedStocks.map((s) => s.id)
    const allChecked = pageIds.every((sid) => selected.has(sid))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) pageIds.forEach((sid) => next.delete(sid))
      else pageIds.forEach((sid) => next.add(sid))
      return next
    })
  }

  async function handleBuy() {
    if (!token || !product) return
    setBuying(true)
    const stockIds = selected.size > 0 ? Array.from(selected) : undefined
    const quantity = stockIds ? stockIds.length : 1
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: product.id, quantity, stockIds }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/dashboard/pesanan/${data.orderId ?? data.firstOrderId ?? ""}`)
      }
    } finally {
      setBuying(false)
    }
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

  const totalPages = Math.ceil(stocks.length / PAGE_SIZE)
  const pagedStocks = stocks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageAllChecked = pagedStocks.length > 0 && pagedStocks.every((s) => selected.has(s.id))
  const pageIndeterminate = !pageAllChecked && pagedStocks.some((s) => selected.has(s.id))

  const selectedCount = selected.size
  const totalPrice = product.price * (selectedCount || 1)

  return (
    <div className="w-full pb-32">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Kembali
      </button>

      <div className="space-y-4">
        {/* Photo */}
        <div className="aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center">
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
          {product.rating > 0 && <StarRating rating={product.rating} />}
          {product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
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

        {/* Stock count + guarantees */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" />
            {product.inStock > 0 ? (
              <>
                <span className="font-medium text-green-600 dark:text-green-400">{product.inStock} unit</span>
                <span className="text-muted-foreground">tersedia</span>
              </>
            ) : (
              <span className="text-destructive">Stok habis</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" /> Akun terverifikasi sebelum dijual
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" /> Garansi 24 jam setelah terima akun
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" /> Kredensial terenkripsi & aman
            </span>
          </div>
        </div>

        {/* Account list with checkboxes */}
        {stocks.length > 0 && (
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
                  `${stocks.length} akun tersedia`
                )}
              </span>
            </div>

            <div className="divide-y divide-border">
              {pagedStocks.map((stock, i) => (
                <label
                  key={stock.id}
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-muted/30"
                >
                  <Checkbox
                    checked={selected.has(stock.id)}
                    onCheckedChange={() => toggleStock(stock.id)}
                  />
                  <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </span>
                  <div className="flex flex-1 items-center gap-2">
                    <User className="size-3 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm">{stock.username ?? "—"}</span>
                  </div>
                  {stock.hasTwoFactor && (
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <KeyRound className="size-3" />
                      2FA
                    </span>
                  )}
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
      </div>

      {/* Floating bottom bar */}
      <div
        className="fixed bottom-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md transition-[left] duration-200 ease-linear"
        style={{ left: sidebarOpen ? "var(--sidebar-width)" : "0px" }}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {selectedCount > 0 ? `${selectedCount} akun dipilih` : "Harga per akun"}
            </p>
            <p className="text-xl font-bold">
              {product.price > 0 ? `Rp ${totalPrice.toLocaleString("id")}` : "Hubungi kami"}
            </p>
          </div>

          {product.inStock > 0 ? (
            <Button size="lg" onClick={handleBuy} disabled={buying} className="shrink-0">
              <ShoppingCart className="size-4" />
              {buying ? "Memproses..." : selectedCount > 0 ? `Beli ${selectedCount} Akun` : "Beli Sekarang"}
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
