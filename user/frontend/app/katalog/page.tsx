import { ShieldCheck, Star, Search } from "lucide-react"
import Image from "next/image"
import { apiFetch, type Section, type Product } from "@/lib/api"

export const metadata = {
  title: "Katalog Produk",
  description:
    "Jelajahi katalog akun Instagram terverifikasi di Buymium. Filter berdasarkan niche, follower, dan harga.",
}

async function getSections(): Promise<Section[]> {
  try {
    return await apiFetch<Section[]>("/sections")
  } catch {
    return []
  }
}

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

function ProductCard({ product }: { product: Product }) {
  return (
    <a
      href={`/produk/${product.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug group-hover:text-primary">
          {product.title}
        </h3>
        {product.isVerified && (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        )}
      </div>
      <p className="mb-3 line-clamp-2 flex-1 text-xs text-muted-foreground">
        {product.description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {product.price > 0 ? `Rp ${product.price.toLocaleString("id")}` : "Hubungi kami"}
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
    </a>
  )
}

export default async function KatalogPage() {
  const sections = await getSections()
  const allProducts = sections.flatMap((s) => s.listings)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <a href="/" className="flex items-center gap-2 font-semibold">
            <Image src="/buymium_logo.png" alt="Buymium" width={24} height={24} className="rounded-md" />
            <span>Buymium</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <a href="/#cara-kerja" className="hover:text-foreground">Cara Kerja</a>
            <a href="/katalog" className="font-medium text-foreground">Katalog</a>
            <a href="/#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <a
            href="/masuk"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Masuk
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Katalog Produk</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {allProducts.length} produk tersedia · Semua akun sudah terverifikasi
          </p>
        </div>

        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Search className="mb-3 size-12 text-muted-foreground/40" />
            <p className="font-medium">Belum ada produk</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Produk akan segera tersedia. Kembali lagi nanti.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {sections.map((section) => (
              <div key={section.id}>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                  {section.subtitle && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{section.subtitle}</p>
                  )}
                </div>
                {section.listings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada produk di kategori ini.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {section.listings.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer minimal */}
      <footer className="mt-20 border-t border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Buymium · Platform Jual Beli Akun Instagram Terpercaya
      </footer>
    </div>
  )
}
