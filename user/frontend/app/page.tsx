import {
  ShieldCheck,
  Zap,
  Lock,
  RefreshCw,
  Package,
  Headphones,
  Check,
  X,
  Star,
  ArrowRight,
} from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { FaqAccordion } from "@/components/faq-accordion"
import { ProductCardLink } from "@/components/product-card-link"
import { LandingNavbar } from "@/components/landing-navbar"
import { apiFetch, type Stats, type Section, type Testimonial } from "@/lib/api"

async function getStats(): Promise<Stats> {
  try {
    return await apiFetch<Stats>("/products/stats")
  } catch {
    return { totalListings: 0, totalStock: 0, avgRating: 0 }
  }
}

async function getSections(): Promise<Section[]> {
  try {
    return await apiFetch<Section[]>("/sections")
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
    desc: "Berbagai kategori tersedia: niche, follower besar, akun lama, aged account, banyak konten.",
  },
  {
    icon: Headphones,
    title: "Support 24/7",
    desc: "Tim kami siap membantu via tiket. Rata-rata respons < 1 jam di jam kerja.",
  },
]

const PERSONAS = [
  {
    title: "Reseller & Dropshipper",
    desc: "Butuh akun Instagram dengan follower organik untuk jualan? Pilih akun sesuai niche produkmu — fashion, kuliner, elektronik, dll.",
    tag: "Paling populer",
  },
  {
    title: "Brand & Bisnis",
    desc: "Bangun kehadiran brand lebih cepat dengan akun yang sudah punya audiens. Hemat waktu vs grow from scratch.",
    tag: null,
  },
  {
    title: "Developer & QA",
    desc: "Butuh akun throwaway untuk testing integrasi Instagram API, automation tools, atau Puppeteer/Playwright? Kami punya stok aged account.",
    tag: null,
  },
  {
    title: "Influencer & Kreator",
    desc: "Kelola beberapa akun niche sekaligus, atau mulai channel baru tanpa harus grow dari 0 follower.",
    tag: null,
  },
]

const COMPARISON_ROWS = [
  "Verifikasi akun sebelum jual",
  "Kredensial terenkripsi",
  "Garansi 24 jam",
  "Download data langsung",
  "Riwayat pesanan permanen",
  "Support via tiket",
  "Pembayaran manual terverifikasi",
]

type ComparisonValue = boolean | "partial"
const COMPARISON_DATA: [ComparisonValue, ComparisonValue, ComparisonValue][] = [
  [true, false, false],
  [true, false, false],
  [true, "partial", false],
  [true, false, false],
  [true, false, false],
  [true, false, "partial"],
  [true, false, false],
]

function ComparisonCell({ value }: { value: ComparisonValue }) {
  if (value === true)
    return (
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Check className="size-3" />
      </span>
    )
  if (value === "partial")
    return <span className="text-xs text-muted-foreground">tergantung</span>
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-destructive/10 text-destructive">
      <X className="size-3" />
    </span>
  )
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

export default async function Page() {
  const [stats, sections, testimonials] = await Promise.all([
    getStats(),
    getSections(),
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
            <span className="text-primary">Jual Beli Akun Instagram</span>
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
              <a href="/katalog">
                Lihat Katalog
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
                desc: "Jelajahi katalog, filter berdasarkan niche, follower, atau harga. Temukan akun yang cocok dan tambahkan ke keranjang.",
              },
              {
                n: "2",
                title: "Bayar Manual",
                desc: "Transfer ke rekening kami sesuai nominal. Upload bukti transfer di halaman pesanan. Admin verifikasi dalam < 15 menit di jam kerja.",
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

      {/* ── Katalog dari BE ── */}
      {sections.length > 0 && (
        <section id="katalog" className="bg-muted/20 px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="mb-2 text-2xl font-bold">Katalog Produk</h2>
              <p className="text-muted-foreground">Pilih akun yang sesuai kebutuhanmu.</p>
            </div>
            <div className="space-y-12">
              {sections.map((section) => (
                <div key={section.id}>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">{section.title}</h3>
                    {section.subtitle && (
                      <p className="text-sm text-muted-foreground">{section.subtitle}</p>
                    )}
                  </div>
                  {section.listings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada produk di seksi ini.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {section.listings.map((product) => (
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
                        </ProductCardLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button variant="outline" asChild>
                <a href="/katalog">Lihat Semua Produk</a>
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

      {/* ── Siapa yang Pakai ── */}
      <section className="bg-muted/20 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-2xl font-bold">Siapa yang Pakai Buymium?</h2>
            <p className="text-muted-foreground">
              Kalau kamu kelola lebih dari satu akun, ini untuk kamu.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {PERSONAS.map((p) => (
              <div key={p.title} className="relative rounded-xl border border-border bg-card p-5">
                {p.tag && (
                  <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {p.tag}
                  </span>
                )}
                <h3 className="mb-2 font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-2xl font-bold">Bukan Sekadar Penjual Akun Biasa</h2>
            <p className="text-muted-foreground">
              Banyak yang jual akun asal-asalan. Buymium adalah platform lengkap dengan proteksi
              pembeli.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="py-3 pl-4 pr-2 text-left font-medium text-muted-foreground">
                    Fitur
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-primary">Buymium</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Marketplace Umum
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Penjual Telegram
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-3 pl-4 pr-2 text-muted-foreground">{row}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <ComparisonCell value={COMPARISON_DATA[i][0]} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <ComparisonCell value={COMPARISON_DATA[i][1]} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <ComparisonCell value={COMPARISON_DATA[i][2]} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                "IG Accounts | Email Outlook | Avatar + Posts | Full Profile | Turkey",
                "IG Accounts | Email verified | Male/Female | Avatar + Bio | Registered Turkey",
                "Akun IG | Verifikasi Email | Tanpa HP | Kosong | Register USA",
                "IG Accounts | Email verified | No phone | Empty | Registered Russia",
                "IG Accounts | Email verified | No phone | Empty | Registered Ukraine",
                "IG Accounts | Email Outlook | Avatar + Posts | Full Profile | Turkey",
              ].map((label, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      U
                    </div>
                    <div>
                      <p className="text-sm font-medium">Pengguna</p>
                      <StarRating rating={5} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{label}</p>
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
      <section className="bg-muted/20 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 text-center">
            <h2 className="mb-2 text-2xl font-bold">Komunitas Pembeli</h2>
          </div>
          <div className="mb-10 rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
            <h3 className="mb-2 font-semibold">
              Jadilah Pembeli Pertama & Dapatkan Keuntungan Ekstra
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Buymium terus berkembang. Pembeli awal yang memberi testimoni dengan izin akan kami
              kredit saldo ekstra dan tampilkan kisahnya di halaman utama.
            </p>
            <Button asChild>
              <a href="/daftar">Mulai Sekarang</a>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: "Testimoni Pembeli", desc: "Cerita nyata dari pembeli aktif." },
              { title: "Metrik Publik", desc: "Jumlah akun terjual, rating rata-rata." },
              { title: "Program Referral", desc: "Ajak teman, dapatkan komisi per transaksi." },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-xl border border-border bg-card p-5 text-center"
              >
                <span className="mb-2 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  Segera Hadir
                </span>
                <h4 className="mb-1 font-semibold">{c.title}</h4>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 grid gap-8 sm:grid-cols-3">
            <div>
              <a href="/" className="mb-3 flex items-center gap-2 font-semibold">
                <Image src="/buymium_logo.png" alt="Buymium" width={20} height={20} className="rounded-md" />
                Buymium
              </a>
              <p className="text-sm text-muted-foreground">
                Platform jual beli akun Instagram terverifikasi. Proses cepat, aman, dan
                terpercaya.
              </p>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">Produk</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/" className="hover:text-foreground">Beranda</a></li>
                <li><a href="/katalog" className="hover:text-foreground">Katalog</a></li>
                <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
                <li><a href="/katalog" className="hover:text-foreground">Followers</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">Bantuan</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/kontak" className="hover:text-foreground">Kontak</a></li>
                <li><a href="/refund" className="hover:text-foreground">Refund</a></li>
                <li><a href="/privasi" className="hover:text-foreground">Privasi</a></li>
                <li><a href="/syarat" className="hover:text-foreground">Syarat</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
            © 2026 Buymium. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
