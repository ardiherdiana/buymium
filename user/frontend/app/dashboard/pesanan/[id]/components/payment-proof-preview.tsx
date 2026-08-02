import { ImageIcon } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"

export function PaymentProofPreview({ paymentProofUrl }: { paymentProofUrl: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <ImageIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Bukti Pembayaran</h2>
      </div>
      <div className="p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${API_BASE}${paymentProofUrl}`}
          alt="Bukti transfer"
          className="w-full rounded-xl border border-border object-contain max-h-80"
        />
      </div>
    </div>
  )
}
