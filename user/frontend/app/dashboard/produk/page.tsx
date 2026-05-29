"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Star, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { Section, Product } from "@/lib/api"

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
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch(`${API_BASE}/sections`)
      .then((r) => r.json())
      .then((d) => setSections(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const allProducts: (Product & { sectionTitle: string })[] = sections.flatMap((s) =>
    s.listings.map((p) => ({ ...p, sectionTitle: s.title }))
  )

  const filtered = search.trim()
    ? allProducts.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase()) ||
          p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : null

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-9 w-full max-w-sm" />
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-36 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered ? (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            {filtered.length} hasil untuk &ldquo;{search}&rdquo;
          </p>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada produk yang cocok.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onClick={() => router.push(`/dashboard/produk/${p.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.id}>
              <div className="mb-4">
                <h2 className="text-base font-semibold">{section.title}</h2>
                {section.subtitle && (
                  <p className="text-sm text-muted-foreground">{section.subtitle}</p>
                )}
              </div>
              {section.listings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada produk.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.listings.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onClick={() => router.push(`/dashboard/produk/${p.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
