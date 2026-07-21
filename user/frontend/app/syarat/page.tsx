import type { Metadata } from "next"
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react"
import { LandingNavbar } from "@/components/landing-navbar"
import { LegalNav } from "@/components/legal-nav"
import { LegalSection } from "@/components/legal-section"

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Syarat & ketentuan penggunaan layanan Buymium — platform jual beli akun media sosial terverifikasi.",
}

export default function SyaratPage() {
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
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Syarat & Ketentuan</h1>
            <p className="text-muted-foreground">
              Ketentuan penggunaan layanan Buymium. Dengan melakukan pembelian, Anda dianggap
              telah membaca dan menyetujui seluruh ketentuan berikut.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Terakhir diperbarui: 17 Juli 2026
            </p>
          </div>

          <LegalNav active="syarat" />

          <div className="space-y-4">
            <LegalSection icon={FileText} title="Tentang Layanan">
              <p>
                Buymium adalah platform yang menyediakan jasa jual beli akun media sosial
                (Instagram dan platform lain sesuai katalog) yang telah diverifikasi secara
                manual oleh tim kami sebelum ditawarkan kepada pengguna.
              </p>
            </LegalSection>

            <LegalSection icon={FileText} title="Akun & Pemesanan">
              <p>
                Pengguna wajib mendaftar dan melakukan pemesanan menggunakan data yang benar dan
                dapat dipertanggungjawabkan. Setiap pesanan bersifat mengikat setelah bukti
                pembayaran diunggah dan dikonfirmasi oleh admin.
              </p>
              <p>
                Pesanan yang belum dibayar akan otomatis dibatalkan dalam waktu <strong>24 jam</strong>
                {" "}sejak dibuat.
              </p>
            </LegalSection>

            <LegalSection icon={FileText} title="Pembayaran">
              <p>
                Pembayaran dilakukan melalui metode transfer bank/e-wallet yang tertera pada
                halaman checkout. Pesanan akan diproses setelah bukti pembayaran diverifikasi oleh
                tim kami, umumnya dalam waktu kurang dari 15 menit pada jam operasional.
              </p>
            </LegalSection>

            <LegalSection icon={ShieldCheck} title="Tanggung Jawab Pengguna">
              <p>
                Setelah kredensial akun diterima, pengguna wajib menjaga kerahasiaan data akun dan
                tidak mengubah email, username, password, atau pengaturan keamanan lain dalam
                waktu <strong>7 hari</strong> pertama setelah login, guna menjaga stabilitas akun dan
                menghindari risiko suspend/banned.
              </p>
              <p>
                Buymium tidak bertanggung jawab atas kerugian yang timbul akibat kelalaian
                pengguna dalam mengikuti panduan penggunaan akun yang telah diberikan.
              </p>
            </LegalSection>

            <LegalSection icon={FileText} title="Larangan">
              <p>
                Pengguna dilarang menggunakan layanan Buymium untuk tujuan yang melanggar hukum
                yang berlaku di Indonesia, termasuk namun tidak terbatas pada penipuan, pencucian
                uang, atau penyalahgunaan identitas pihak lain.
              </p>
            </LegalSection>

            <LegalSection icon={FileText} title="Perubahan Ketentuan">
              <p>
                Buymium berhak mengubah atau memperbarui syarat & ketentuan ini sewaktu-waktu.
                Perubahan akan diinformasikan melalui halaman ini dan berlaku efektif sejak
                tanggal pembaruan dicantumkan.
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
