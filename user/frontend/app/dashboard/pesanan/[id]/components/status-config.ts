import { Banknote, CheckCircle2, Clock } from "lucide-react"

export const STEPS = [
  { key: "pending",              label: "Pembayaran", icon: Banknote },
  { key: "awaiting_confirmation", label: "Verifikasi",  icon: Clock },
  { key: "paid",                 label: "Lunas",       icon: CheckCircle2 },
]
export const STEP_ORDER = ["pending", "awaiting_confirmation", "paid"]

export const STATUS_CONFIG: Record<string, {
  label: string
  desc: string
  badge: string
  accent: string
}> = {
  pending: {
    label: "Menunggu Pembayaran",
    desc: "Silakan scan QRIS lalu upload bukti pembayaran.",
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/20",
    accent: "border-border",
  },
  awaiting_confirmation: {
    label: "Menunggu Verifikasi",
    desc: "Bukti pembayaran sedang diverifikasi oleh admin. Biasanya < 15 menit.",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    accent: "border-border",
  },
  paid: {
    label: "Lunas — Siap Didownload",
    desc: "Pembayaran dikonfirmasi. Silakan download kredensial akun kamu.",
    badge: "bg-green-500/15 text-green-400 border-green-500/20",
    accent: "border-border",
  },
  cancelled: {
    label: "Pesanan Dibatalkan",
    desc: "Pesanan ini telah dibatalkan.",
    badge: "bg-red-500/15 text-red-400 border-red-500/20",
    accent: "border-border",
  },
}
