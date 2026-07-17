import type { Metadata } from "next"
import { ArrowLeft, ShieldCheck, FileText, RotateCcw, HelpCircle } from "lucide-react"
import { FaqAccordion } from "@/components/faq-accordion"
import { LandingNavbar } from "@/components/landing-navbar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Syarat & Ketentuan, Kebijakan Refund, dan Pertanyaan Umum (FAQ) layanan Buymium — platform jual beli akun media sosial terverifikasi.",
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-7">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_strong]:font-medium">
        {children}
      </div>
    </div>
  )
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
              Ketentuan penggunaan layanan, kebijakan refund, dan pertanyaan yang sering diajukan.
              Dengan melakukan pembelian di Buymium, Anda dianggap telah membaca dan menyetujui
              seluruh ketentuan berikut.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Terakhir diperbarui: 17 Juli 2026
            </p>
          </div>

          <Tabs defaultValue="terms">
            <TabsList className="mb-8 grid h-auto w-full grid-cols-3 gap-1 bg-muted/60 p-1">
              <TabsTrigger
                value="terms"
                className="h-auto gap-1.5 whitespace-normal py-2 text-center text-[11px] leading-tight sm:py-1.5 sm:text-sm"
              >
                <FileText className="hidden size-3.5 shrink-0 sm:block" />
                <span>Syarat & Ketentuan</span>
              </TabsTrigger>
              <TabsTrigger
                value="refund"
                className="h-auto gap-1.5 whitespace-normal py-2 text-center text-[11px] leading-tight sm:py-1.5 sm:text-sm"
              >
                <RotateCcw className="hidden size-3.5 shrink-0 sm:block" />
                <span>Kebijakan Refund</span>
              </TabsTrigger>
              <TabsTrigger
                value="faq"
                className="h-auto gap-1.5 whitespace-normal py-2 text-center text-[11px] leading-tight sm:py-1.5 sm:text-sm"
              >
                <HelpCircle className="hidden size-3.5 shrink-0 sm:block" />
                <span>FAQ</span>
              </TabsTrigger>
            </TabsList>

            {/* ── Syarat & Ketentuan ── */}
            <TabsContent value="terms" className="space-y-4">
              <Section icon={FileText} title="Tentang Layanan">
                <p>
                  Buymium adalah platform yang menyediakan jasa jual beli akun media sosial
                  (Instagram dan platform lain sesuai katalog) yang telah diverifikasi secara
                  manual oleh tim kami sebelum ditawarkan kepada pengguna.
                </p>
              </Section>

              <Section icon={FileText} title="Akun & Pemesanan">
                <p>
                  Pengguna wajib mendaftar dan melakukan pemesanan menggunakan data yang benar dan
                  dapat dipertanggungjawabkan. Setiap pesanan bersifat mengikat setelah bukti
                  pembayaran diunggah dan dikonfirmasi oleh admin.
                </p>
                <p>
                  Pesanan yang belum dibayar akan otomatis dibatalkan dalam waktu <strong>24 jam</strong>
                  {" "}sejak dibuat.
                </p>
              </Section>

              <Section icon={FileText} title="Pembayaran">
                <p>
                  Pembayaran dilakukan melalui metode transfer bank/e-wallet yang tertera pada
                  halaman checkout. Pesanan akan diproses setelah bukti pembayaran diverifikasi oleh
                  tim kami, umumnya dalam waktu kurang dari 15 menit pada jam operasional.
                </p>
              </Section>

              <Section icon={ShieldCheck} title="Tanggung Jawab Pengguna">
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
              </Section>

              <Section icon={FileText} title="Larangan">
                <p>
                  Pengguna dilarang menggunakan layanan Buymium untuk tujuan yang melanggar hukum
                  yang berlaku di Indonesia, termasuk namun tidak terbatas pada penipuan, pencucian
                  uang, atau penyalahgunaan identitas pihak lain.
                </p>
              </Section>

              <Section icon={FileText} title="Perubahan Ketentuan">
                <p>
                  Buymium berhak mengubah atau memperbarui syarat & ketentuan ini sewaktu-waktu.
                  Perubahan akan diinformasikan melalui halaman ini dan berlaku efektif sejak
                  tanggal pembaruan dicantumkan.
                </p>
              </Section>
            </TabsContent>

            {/* ── Kebijakan Refund ── */}
            <TabsContent value="refund" className="space-y-4">
              <Section icon={ShieldCheck} title="Garansi Suspend 7 Hari">
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
              </Section>

              <Section icon={RotateCcw} title="Ketentuan Refund Lainnya">
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
              </Section>
            </TabsContent>

            {/* ── FAQ ── */}
            <TabsContent value="faq">
              <div className="rounded-xl border border-border bg-card p-6 sm:p-7">
                <FaqAccordion />
              </div>
            </TabsContent>
          </Tabs>
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
