"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const FAQS = [
  {
    q: "Akun yang dijual benar-benar real dan aman?",
    a: "Ya. Setiap akun dicek manual oleh tim kami: usia akun, jumlah follower, status ban, dan tes login sebelum masuk katalog. Akun yang gagal verifikasi tidak kami jual.",
  },
  {
    q: "Bagaimana cara membayar?",
    a: "Transfer manual ke rekening yang kami tampilkan di halaman checkout. Setelah transfer, upload foto/screenshot bukti pembayaran di halaman pesanan Anda.",
  },
  {
    q: "Berapa lama proses verifikasi pembayaran?",
    a: "Umumnya kurang dari 15 menit di jam kerja (08.00–22.00 WIB). Di luar jam kerja mungkin lebih lama, namun rata-rata tetap di bawah 2 jam.",
  },
  {
    q: "Apa yang saya dapatkan setelah pembayaran dikonfirmasi?",
    a: "Data lengkap akun (username, password, email, dan kode 2FA jika ada) langsung tersedia dan bisa di-download dari halaman riwayat pesanan Anda.",
  },
  {
    q: "Apakah ada garansi jika akun bermasalah?",
    a: "Ada. Jika akun tidak bisa login saat serah-terima, kami ganti dengan akun setara atau refund penuh. Garansi berlaku 24 jam sejak pembayaran dikonfirmasi.",
  },
  {
    q: "Apakah ada minimum pembelian?",
    a: "Tidak ada. Anda bisa membeli 1 akun saja. Tidak ada minimum order maupun biaya tambahan tersembunyi.",
  },
]

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="divide-y divide-border">
      {FAQS.map((faq, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium transition-colors hover:text-primary"
          >
            {faq.q}
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open === i && "rotate-180",
              )}
            />
          </button>
          {open === i && (
            <p className="pb-4 text-sm text-muted-foreground">{faq.a}</p>
          )}
        </div>
      ))}
    </div>
  )
}
