import type { Metadata } from "next"
import { ArrowLeft, RotateCcw, ShieldCheck } from "lucide-react"
import { LandingNavbar } from "@/components/landing-navbar"
import { LegalNav } from "@/components/legal-nav"
import { LegalSection } from "@/components/legal-section"

export const metadata: Metadata = {
  title: "Kebijakan Refund",
  description:
    "Kebijakan refund dan garansi suspend Buymium — prosedur pengembalian dana ke pelanggan.",
}

export default function RefundPage() {
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
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Kebijakan Refund</h1>
            <p className="text-muted-foreground">
              Prosedur garansi dan pengembalian dana untuk pesanan di Buymium.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Terakhir diperbarui: 17 Juli 2026
            </p>
          </div>

          <LegalNav active="refund" />

          <div className="space-y-4">
            <LegalSection icon={ShieldCheck} title="Garansi Suspend 7 Hari">
              <p>
                Kami memberikan <strong>Garansi Suspend</strong> selama <strong>7 (tujuh) hari</strong> terhitung
                sejak data akun dikirimkan kepada pembeli. Garansi berlaku dengan ketentuan sebagai
                berikut:
              </p>
              <ul className="ml-4 list-disc space-y-1.5">
                <li>
                  Akun berhasil login dan data-data akun (email, username, password, dll)
                  <strong> belum diubah</strong> oleh pembeli.
                </li>
                <li>
                  Klaim garansi diajukan dalam rentang waktu 7 hari sejak akun diterima, melalui
                  halaman <a href="/kontak" className="text-primary underline underline-offset-2">Kontak</a>.
                </li>
              </ul>
              <p>
                Apabila akun mengalami suspend/banned/disable dalam periode tersebut dan
                memenuhi syarat di atas, pembeli berhak memilih salah satu dari opsi berikut:
              </p>
              <ol className="ml-4 list-decimal space-y-1.5">
                <li>Penggantian akun baru secara gratis (maksimal 1x), atau</li>
                <li>Pengembalian dana (refund) sebesar <strong>60% dari nilai pembelian</strong>, ditransfer ke rekening pembeli.</li>
              </ol>
            </LegalSection>

            <LegalSection icon={RotateCcw} title="Ketentuan Refund Lainnya">
              <ul className="ml-4 list-disc space-y-1.5">
                <li>
                  Pesanan yang dibatalkan sebelum bukti pembayaran diunggah tidak dikenakan biaya
                  apa pun.
                </li>
                <li>
                  Pengajuan refund akibat kesalahan sistem pembayaran (dana terpotong namun
                  pesanan gagal terbentuk) akan diproses penuh (100%) maksimal <strong>3x24 jam kerja</strong>{" "}
                  setelah verifikasi.
                </li>
                <li>
                  Refund <strong>tidak berlaku</strong> untuk akun yang mengalami suspend akibat
                  pelanggaran ketentuan penggunaan oleh pembeli (mengubah data akun dalam masa
                  garansi, aktivitas mencurigakan, dll).
                </li>
                <li>
                  Proses refund dilakukan melalui metode pembayaran/rekening yang sama dengan
                  transaksi awal, kecuali disepakati lain dengan tim kami.
                </li>
              </ul>
              <p>
                Dengan melakukan pembelian, pembeli dianggap telah membaca, memahami, dan
                menyetujui seluruh ketentuan garansi dan refund di atas.
              </p>
            </LegalSection>
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
