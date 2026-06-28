"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Star, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { Product } from "@/lib/api"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`size-3 ${s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  )
}

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug group-hover:text-primary line-clamp-2">
          {product.title}
        </h3>
        {product.isVerified && (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        )}
      </div>
      <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
        {product.description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {product.price > 0
            ? `Rp ${product.price.toLocaleString("id")}`
            : "Hubungi kami"}
        </span>
        <span className="text-xs text-muted-foreground">{product.inStock} stok</span>
      </div>
      {product.rating > 0 && (
        <div className="mt-2">
          <StarRating rating={product.rating} />
        </div>
      )}
      {product.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {product.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardProdukListPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const params = new URLSearchParams({ limit: "100" })
    if (search.trim()) params.set("search", search.trim())

    fetch(`${API_BASE}/products?${params}`)
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d.data) ? d.data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search])

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ? "Tidak ada produk yang cocok." : "Belum ada produk."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onClick={() => router.push(`/dashboard/produk/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
