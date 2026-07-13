import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const FAQS = [
  {
    q: "Akun yang dijual benar-benar real dan aman?",
    a: "Ya. Setiap akun dicek manual oleh tim kami: usia akun, jumlah follower, status ban, dan tes login sebelum masuk katalog. Akun yang gagal verifikasi tidak kami jual.",
  },
  {
    q: "Bagaimana cara membayar?",
    a: "Transfer ke rekening yang kami tampilkan di halaman checkout sesuai nominal pesanan. Setelah transfer, upload foto/screenshot bukti pembayaran di halaman pesanan Anda.",
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
    q: "Bagaimana cara login ke akun yang saya beli?",
    a: "Bisa langsung login pakai username dan password nya, ga perlu login gmail. Kalau ada OTP, silakan kunjungi website dengan cari di google dengan kata kunci buymium.store. Masukkan alamat email yang diberikan admin pada kolom yang tersedia — jika sesuai, kode akan otomatis muncul di layar untuk langsung Anda salin.",
  },
  {
    q: "Bagaimana cara menghindari suspend?",
    a: "Dilarang mengganti email, username, password, dll selama 7 hari setelah login agar menghindari suspend. Anda bisa gunakan akun untuk aktivitas biasa seperti scroll dll agar akun lengket ke perangkat yang baru login.",
  },
  {
    q: "Apakah ada garansi jika akun bermasalah?",
    a: "Ada. Jika akun mengalami suspend/banned/disable, penjual akan memberikan: 1) ganti gratis 1 akun atau gratis isi followers sejumlah yang dipesan, atau 2) dikirim ke akun lain milik pembeli, atau 3) refund 70% cash ke rekening pembeli. Silakan hubungi admin untuk klaim garansi.",
  },
  {
    q: "Apakah ada minimum pembelian?",
    a: "Tidak ada. Anda bisa membeli 1 akun saja. Tidak ada minimum order maupun biaya tambahan tersembunyi.",
  },
]

export function FaqAccordion() {
  return (
    <Accordion type="single" collapsible>
      {FAQS.map((faq, i) => (
        <AccordionItem key={i} value={String(i)}>
          <AccordionTrigger>{faq.q}</AccordionTrigger>
          <AccordionContent>{faq.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
