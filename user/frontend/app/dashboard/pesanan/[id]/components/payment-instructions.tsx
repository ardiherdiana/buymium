import Image from "next/image"
import { AlertCircle, QrCode } from "lucide-react"
import { UploadZone } from "./upload-zone"
import { CopyButton } from "./copy-button"

const QRIS_URL = process.env.NEXT_PUBLIC_QRIS_URL ?? "/qris.jpeg"

export function PaymentInstructions({ grandTotal, onFile, uploading, uploadSuccess }: {
  grandTotal: number
  onFile: (f: File) => void
  uploading: boolean
  uploadSuccess: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <QrCode className="size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">Pembayaran</p>
          <p className="text-[11px] text-muted-foreground">Pilih cara pembayaran yang kamu inginkan</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Total */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3.5">
          <div>
            <p className="text-xs text-muted-foreground">Total Pembayaran</p>
            <p className="text-xl font-bold">Rp{grandTotal.toLocaleString("id")}</p>
          </div>
          <CopyButton text={String(grandTotal)} />
        </div>

        {/* Grid: QRIS kiri, Upload kanan */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Kiri — QRIS */}
          <div className="flex items-center justify-center rounded-xl border border-border bg-white p-4">
            <Image
              src={QRIS_URL}
              alt="QRIS Buymium"
              width={260}
              height={260}
              className="rounded-lg object-contain"
              unoptimized
            />
          </div>

          {/* Kanan — upload */}
          <UploadZone
            onFile={onFile}
            uploading={uploading}
            success={uploadSuccess}
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Setelah bayar &amp; upload bukti, admin memverifikasi dalam <strong className="text-foreground">5–15 menit</strong> di jam kerja (08.00–22.00 WIB).
          </p>
        </div>
      </div>
    </div>
  )
}
