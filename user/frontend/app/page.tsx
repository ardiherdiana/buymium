import {
  ShieldCheck,
  Zap,
  Lock,
  RefreshCw,
  Package,
  Headphones,
  Star,
  ArrowRight,
} from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { FaqAccordion } from "@/components/faq-accordion"
import { ProductCardLink } from "@/components/product-card-link"
import { LandingNavbar } from "@/components/landing-navbar"
import { apiFetch, type Stats, type Product, type Testimonial } from "@/lib/api"

async function getStats(): Promise<Stats> {
  try {
    return await apiFetch<Stats>("/products/stats")
  } catch {
    return { totalListings: 0, totalStock: 0, avgRating: 0 }
  }
}

async function getProducts(): Promise<Product[]> {
  try {
    const res = await apiFetch<{ data: Product[] }>("/products?limit=9")
    return res.data ?? []
  } catch {
    return []
  }
}

async function getTestimonials(): Promise<Testimonial[]> {
  try {
    return await apiFetch<Testimonial[]>("/testimonials?limit=6")
  } catch {
    return []
  }
}

const WHY_FEATURES = [
  {
    icon: ShieldCheck,
    title: "Akun Terverifikasi",
    desc: "Setiap akun dicek manual: usia, follower, status ban, dan login sebelum masuk katalog.",
  },
  {
    icon: Zap,
    title: "Pengiriman Cepat",
    desc: "Data akun langsung tersedia setelah admin konfirmasi pembayaran, umumnya < 15 menit di jam kerja.",
  },
  {
    icon: Lock,
    title: "Data Aman",
    desc: "Kredensial akun dienkripsi di server kami dan hanya bisa diakses oleh pembeli setelah konfirmasi.",
  },
  {
    icon: RefreshCw,
    title: "Garansi Refund",
    desc: "Jika akun tidak bisa login saat serah-terima, kami ganti atau refund penuh tanpa syarat ribet.",
  },
  {
    icon: Package,
    title: "Stok Lengkap",
    desc: "Berbagai kategori tersedia: follower besar, akun lama, akun berumur, lengkap dengan konten.",
  },
  {
    icon: Headphones,
    title: "Support 24/7",
    desc: "Tim kami siap membantu via tiket. Rata-rata respons < 1 jam di jam kerja.",
  },
]


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

export default async function Page() {
  const [stats, products, testimonials] = await Promise.all([
    getStats(),
    getProducts(),
    getTestimonials(),
  ])

  return (
    <div className="min-h-screen">
      {/* ── Navbar ── */}
      <LandingNavbar />

      {/* ── Hero ── */}
      <section className="bg-gradient-to-b from-primary/5 to-background px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-green-500" />
            Tidak ada biaya tersembunyi · Garansi 24 jam
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Platform Terpercaya<br />
            <span className="text-primary">Beli Akun Instagram</span>
          </h1>
          <p className="mb-2 text-lg text-muted-foreground">
            Akun Instagram Berkualitas. Harga Terjangkau.
          </p>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            Beli akun terverifikasi dengan rating tinggi. Proses cepat, aman, transparan.
            Cocok untuk reseller, brand, developer, dan kreator konten.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href="/masuk">
                Mulai Sekarang
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#cara-kerja">Cara Kerja</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-3xl grid-cols-3 divide-x divide-border px-4 py-6 text-center">
          <div className="px-4">
            <p className="text-2xl font-bold tabular-nums">{stats.totalListings}</p>
            <p className="text-xs text-muted-foreground">Listing Aktif</p>
          </div>
          <div className="px-4">
            <p className="text-2xl font-bold tabular-nums">
              {stats.totalStock.toLocaleString("id")}
            </p>
            <p className="text-xs text-muted-foreground">Total Stok</p>
          </div>
          <div className="px-4">
            <p className="text-2xl font-bold tabular-nums">
              {stats.avgRating > 0 ? `${stats.avgRating}★` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Rata-rata Rating</p>
          </div>
        </div>
      </section>

      {/* ── Cara Kerja ── */}
      <section id="cara-kerja" className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-2xl font-bold">Cara Kerja</h2>
            <p className="text-muted-foreground">
              Dari pilih akun sampai akun di tangan, hanya tiga langkah.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                n: "1",
                title: "Pilih & Tambah ke Keranjang",
                desc: "Jelajahi katalog, filter berdasarkan kategori, follower, atau harga. Temukan akun yang cocok dan tambahkan ke keranjang.",
              },
              {
                n: "2",
                title: "Transfer & Konfirmasi",
                desc: "Transfer ke rekening kami sesuai nominal. Upload bukti transfer di halaman pesanan. Tim kami verifikasi dalam < 15 menit di jam kerja.",
              },
              {
                n: "3",
                title: "Terima Kredensial Akun",
                desc: "Setelah dikonfirmasi, data akun (username, password, email, 2FA) langsung bisa di-download dari dashboard pesanan.",
              },
            ].map((step) => (
              <div key={step.n} className="relative rounded-xl border border-border bg-card p-6">
                <div className="mb-4 inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step.n}
                </div>
                <h3 className="mb-2 font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Katalog Produk ── */}
      {products.length > 0 && (
        <section id="katalog" className="bg-muted/20 px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="mb-2 text-2xl font-bold">Katalog Produk</h2>
              <p className="text-muted-foreground">Pilih akun yang sesuai kebutuhanmu.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCardLink
                  key={product.id}
                  productId={product.id}
                  className="group rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium leading-snug group-hover:text-primary">
                      {product.title}
                    </h4>
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
                    <span className="text-xs text-muted-foreground">
                      {product.inStock} stok
                    </span>
                  </div>
                  {product.rating > 0 && (
                    <div className="mt-2">
                      <StarRating rating={product.rating} />
                    </div>
                  )}
                </ProductCardLink>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button variant="outline" asChild>
                <a href="/masuk">Lihat Semua Produk</a>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── Mengapa Buymium ── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-2xl font-bold">Mengapa Buymium?</h2>
            <p className="text-muted-foreground">
              Setiap fitur ada karena kami membutuhkannya sendiri.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="size-5 text-primary" />
                </div>
                <h3 className="mb-1 font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimoni ── */}
      <section className="bg-muted/20 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-2xl font-bold">Apa Kata Pelanggan Kami</h2>
            <p className="text-muted-foreground">Sudah dipercaya ratusan pembeli.</p>
          </div>
          {testimonials.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {t.buyerName ? t.buyerName[0].toUpperCase() : "U"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.buyerName || "Pengguna"}</p>
                      <StarRating rating={t.rating} />
                    </div>
                  </div>
                  {t.product && (
                    <p className="mb-2 text-xs text-muted-foreground">{t.product.title}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{t.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: "Rizki A.", content: "Prosesnya cepat banget, kurang dari 10 menit sudah bisa login. Akun sesuai deskripsi dan tidak ada masalah sama sekali." },
                { name: "Dinda S.", content: "Sudah beli 3 kali di sini, semua lancar. Kredensial langsung bisa didownload setelah pembayaran dikonfirmasi." },
                { name: "Fajar M.", content: "Garansinya beneran berlaku. Waktu akun pertama saya bermasalah, langsung diganti tanpa ribet. Recommended!" },
                { name: "Hana W.", content: "Tampilannya bersih dan mudah dipakai. Tidak ada biaya tersembunyi, harga yang tertera sudah final." },
                { name: "Andi P.", content: "Enkripsi kredensial bikin tenang, data tidak sembarangan dibagikan. Support juga responsif waktu saya ada pertanyaan." },
                { name: "Sari L.", content: "Platform paling profesional yang pernah saya coba untuk beli akun. Proses verifikasi pembayarannya transparan." },
              ].map((t, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <StarRating rating={5} />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="px-4 py-20">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <h2 className="mb-2 text-2xl font-bold">Pertanyaan Umum</h2>
            <p className="text-muted-foreground">Masih penasaran? Lihat FAQ lengkap</p>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* ── Community ── */}
      {/* ── Footer ── */}
      <footer className="border-t border-border px-4 py-6">
        <div className="mx-auto max-w-5xl text-center text-xs text-muted-foreground">
          © 2026 Buymium. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
