import { CheckCircle2, Download, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DownloadSection({ downloading, downloadingInvoice, onDownload, onDownloadInvoice }: {
  downloading: boolean
  downloadingInvoice: boolean
  onDownload: () => void
  onDownloadInvoice: () => void
}) {
  return (
    <div className="rounded-2xl border border-green-500/20 bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-green-500/15 bg-green-500/5 px-5 py-3.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-green-500/15">
          <CheckCircle2 className="size-4 text-green-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-green-400">Akun Siap Didownload</p>
          <p className="text-[11px] text-green-400/70">Simpan file dengan aman di perangkatmu</p>
        </div>
      </div>
      <div className="p-5 space-y-2">
        <Button className="w-full" onClick={onDownload} disabled={downloading}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download Kredensial Akun
        </Button>
        <Button className="w-full" variant="outline" onClick={onDownloadInvoice} disabled={downloadingInvoice}>
          {downloadingInvoice ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          Download Invoice
        </Button>
      </div>
    </div>
  )
}
