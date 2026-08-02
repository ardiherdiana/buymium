import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CancelOrder({ cancelConfirm, setCancelConfirm, cancelling, onCancel }: {
  cancelConfirm: boolean
  setCancelConfirm: (v: boolean) => void
  cancelling: boolean
  onCancel: () => void
}) {
  return (
    <div className="flex justify-center pt-2">
      {!cancelConfirm ? (
        <button
          onClick={() => setCancelConfirm(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3.5" />
          Batalkan pesanan ini
        </button>
      ) : (
        <div className="flex w-full items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <span className="flex-1 text-xs text-muted-foreground">Yakin ingin membatalkan pesanan?</span>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            disabled={cancelling}
            onClick={onCancel}
          >
            {cancelling ? <Loader2 className="size-3 animate-spin" /> : "Ya, batalkan"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setCancelConfirm(false)}
          >
            Tidak
          </Button>
        </div>
      )}
    </div>
  )
}
