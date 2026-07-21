import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { FaqAccordion } from "@/components/faq-accordion"
import { LandingNavbar } from "@/components/landing-navbar"
import { LegalNav } from "@/components/legal-nav"

export const metadata: Metadata = {
  title: "FAQ",
  description: "Pertanyaan yang sering diajukan seputar layanan Buymium.",
}

export default function FaqPage() {
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
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Pertanyaan Umum (FAQ)</h1>
            <p className="text-muted-foreground">
              Jawaban untuk pertanyaan yang paling sering ditanyakan pelanggan Buymium.
            </p>
          </div>

          <LegalNav active="faq" />

          <div className="rounded-xl border border-border bg-card p-6 sm:p-7">
            <FaqAccordion />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© 2026 Buymium. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="/" className="hover:text-foreground">Beranda</a>
            <a href="/kontak" className="hover:text-foreground">Kontak</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
