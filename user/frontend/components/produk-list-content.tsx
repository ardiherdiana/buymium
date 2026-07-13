"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Star, ImageOff } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { resolveImageUrl, type Product } from "@/lib/api"

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
  const imageUrl = resolveImageUrl(product.imageUrl)
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="mb-3 aspect-square w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={product.title} className="size-full object-cover" />
        ) : (
          <ImageOff className="size-8 text-muted-foreground/50" />
        )}
      </div>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug group-hover:text-primary line-clamp-2">
          {product.title}
        </h3>
        {product.isVerified && (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        )}
      </div>
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
    </div>
  )
}

export function ProdukListContent({ basePath }: { basePath: string }) {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/products?limit=100`)
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d.data) ? d.data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada produk.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onClick={() => router.push(`${basePath}/${p.slug ?? p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
