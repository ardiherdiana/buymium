import type { Metadata } from "next"
import { ArrowLeft, Mail, MessageCircle, Phone, MapPin, Clock } from "lucide-react"
import { LandingNavbar } from "@/components/landing-navbar"

export const metadata: Metadata = {
  title: "Kontak",
  description: "Hubungi tim Buymium untuk pertanyaan, laporan masalah, atau permintaan bantuan seputar layanan kami.",
}

export default function KontakPage() {
  return (
    <div className="min-h-screen">
      <LandingNavbar />

      <main className="bg-gradient-to-b from-primary/5 to-background px-4 py-16">
        <div className="mx-auto max-w-3xl">
          {/* Back */}
          <a
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Kembali ke beranda
          </a>

          {/* Title */}
          <div className="mb-10">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Kontak</h1>
            <p className="text-muted-foreground">
              Butuh bantuan? Tim kami siap membantu kamu.
            </p>
          </div>

          {/* Contact cards */}
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <MessageCircle className="size-5 text-primary" />
              </div>
              <h2 className="mb-1 font-semibold">WhatsApp</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Cara tercepat untuk menghubungi kami. Respons dalam hitungan menit di jam kerja.
              </p>
              <a
                href="https://wa.me/6285692689599"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Chat via WhatsApp
              </a>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Phone className="size-5 text-primary" />
              </div>
              <h2 className="mb-1 font-semibold">Telepon</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Hubungi kami langsung untuk kebutuhan yang mendesak di jam operasional.
              </p>
              <a
                href="tel:+6285692689599"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                0856-9268-9599
              </a>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="size-5 text-primary" />
              </div>
              <h2 className="mb-1 font-semibold">Email</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Untuk pertanyaan detail, laporan, atau permintaan khusus yang memerlukan dokumentasi.
              </p>
              <a
                href="mailto:buymiumstore@gmail.com"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                buymiumstore@gmail.com
              </a>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="size-5 text-primary" />
              </div>
              <h2 className="mb-1 font-semibold">Alamat Usaha</h2>
              <p className="text-sm text-muted-foreground">
                Jl. Merdeka No. 123, Kelurahan Sukamaju,<br />
                Kecamatan Cibeunying, Kota Bandung,<br />
                Jawa Barat 40123, Indonesia
              </p>
            </div>
          </div>

          <div className="mb-10 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
            Layanan beroperasi sepenuhnya secara online. Alamat usaha di atas digunakan untuk
            keperluan legalitas dan korespondensi administratif.
          </div>

          {/* Response time */}
          <div className="rounded-xl border border-border bg-card p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="mb-2 font-semibold">Jam Operasional</h2>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Senin – Minggu: <span className="text-foreground font-medium">08.00 – 22.00 WIB</span></p>
                  <p className="mt-2">
                    Rata-rata waktu respons <span className="text-foreground font-medium">&lt; 1 jam</span> di jam kerja.
                    Di luar jam kerja, pesan kamu tetap kami proses dan akan dibalas secepatnya.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ prompt */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
            <h2 className="mb-2 font-semibold">Cek FAQ Dulu</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Banyak pertanyaan umum sudah terjawab di halaman Syarat & Ketentuan kami — mulai dari
              cara membayar, proses verifikasi, hingga kebijakan garansi dan refund.
            </p>
            <a
              href="/syarat"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Lihat Syarat & Ketentuan
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© 2026 Buymium. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="/" className="hover:text-foreground">Beranda</a>
            <a href="/syarat" className="hover:text-foreground">Syarat & Ketentuan</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
