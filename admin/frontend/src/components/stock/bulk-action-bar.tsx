import { ShoppingCart, ScanLine, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BulkActionBarProps {
  count: number
  onSell: () => void
  onScan: () => void
  onCopy: () => void
  onDelete: () => void
}

/** Shared floating bulk-selection action bar used by the stock listing pages (mobile + desktop). */
export function BulkActionBar({ count, onSell, onScan, onCopy, onDelete }: BulkActionBarProps) {
  if (count === 0) return null
  return (
    <>
      {/* Mobile: full-width bottom bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-background border-t shadow-2xl px-4 pt-2 pb-3 flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">{count} akun dipilih</span>
        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onSell}>
            <ShoppingCart className="size-3.5" />
            Terjual
          </Button>
          <Button size="sm" className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={onScan}>
            <ScanLine className="size-3.5" />
            Pindai
          </Button>
          <Button size="sm" className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={onCopy}>
            <Copy className="size-3.5" />
            Salin
          </Button>
          <Button size="sm" variant="destructive" className="flex-1 gap-1.5" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            Hapus
          </Button>
        </div>
      </div>
      {/* Desktop: centered floating pill */}
      <div className="hidden sm:flex fixed bottom-4 left-1/2 -translate-x-1/2 z-20 bg-background border rounded-lg shadow-2xl px-4 py-3 items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground mr-1">{count} akun</span>
        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onSell}>
          <ShoppingCart className="size-3.5" />
          Terjual
        </Button>
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={onScan}>
          <ScanLine className="size-3.5" />
          Pindai
        </Button>
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={onCopy}>
          <Copy className="size-3.5" />
          Salin
        </Button>
        <Button size="sm" variant="destructive" className="gap-1.5" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Hapus
        </Button>
      </div>
    </>
  )
}
