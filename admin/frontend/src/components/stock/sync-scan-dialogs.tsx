import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dropdown } from "@/components/ui/dropdown-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ProgressState } from "@/hooks/use-stock-listing"

interface Option {
  value: string
  label: string
}

interface ProgressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  runningTitle: string
  doneLabel: string
  sourceOptions: Option[]
  sourceId: string
  onSourceIdChange: (v: string) => void
  progress: ProgressState
  runningStatus: "syncing" | "scanning"
  onRun: () => void
  runLabel: string
}

function ProgressDialog({
  open, onOpenChange, title, runningTitle, doneLabel,
  sourceOptions, sourceId, onSourceIdChange, progress, runningStatus, onRun, runLabel,
}: ProgressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (progress.status === runningStatus) return; onOpenChange(o) }}>
      <DialogContent className="max-w-md">
        {progress.status === "idle" ? (
          <>
            <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium">Source</p>
              <Dropdown options={sourceOptions} value={sourceId} onChange={onSourceIdChange} className="w-full" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button onClick={onRun}>{runLabel}</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className={`size-5 ${progress.status === runningStatus ? "animate-spin" : ""}`} />
                {runningTitle}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="text-muted-foreground">{progress.current} / {progress.total || "..."}</span>
              </div>
              <div className="h-2 w-full bg-secondary overflow-hidden rounded">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : "0%" }}
                />
              </div>
            </div>
            {progress.status === "done" && (
              <div className="rounded bg-emerald-50 border border-emerald-200 px-4 py-3">
                <p className="text-sm font-medium text-emerald-700">{doneLabel}</p>
              </div>
            )}
            {progress.status === "error" && (
              <div className="rounded bg-destructive/10 border border-destructive/20 px-4 py-3">
                <p className="text-sm font-medium text-destructive">{progress.error}</p>
              </div>
            )}
            {(progress.status === "done" || progress.status === "error") && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface SyncScanDialogsProps {
  sourceOptions: Option[]
  syncDialogOpen: boolean
  onSyncOpenChange: (open: boolean) => void
  syncSourceId: string
  onSyncSourceIdChange: (v: string) => void
  syncProgress: ProgressState
  onRunSync: () => void
  scanDialogOpen: boolean
  onScanOpenChange: (open: boolean) => void
  scanSourceId: string
  onScanSourceIdChange: (v: string) => void
  scanProgress: ProgressState
  onRunScan: () => void
  syncTitle?: string
}

/** Shared "Sync with Google Sheets" + "Scan Followers" dialogs used by the stock listing pages. */
export function SyncScanDialogs({
  sourceOptions,
  syncDialogOpen, onSyncOpenChange, syncSourceId, onSyncSourceIdChange, syncProgress, onRunSync,
  scanDialogOpen, onScanOpenChange, scanSourceId, onScanSourceIdChange, scanProgress, onRunScan,
  syncTitle = "Sync with Google Sheets",
}: SyncScanDialogsProps) {
  return (
    <>
      <ProgressDialog
        open={scanDialogOpen}
        onOpenChange={onScanOpenChange}
        title="Scan Followers"
        runningTitle="Scan Followers"
        doneLabel="Pemindaian selesai!"
        sourceOptions={sourceOptions}
        sourceId={scanSourceId}
        onSourceIdChange={onScanSourceIdChange}
        progress={scanProgress}
        runningStatus="scanning"
        onRun={onRunScan}
        runLabel="Pindai"
      />
      <ProgressDialog
        open={syncDialogOpen}
        onOpenChange={onSyncOpenChange}
        title={syncTitle}
        runningTitle="Sync Google Sheets"
        doneLabel="Sinkronisasi selesai!"
        sourceOptions={sourceOptions}
        sourceId={syncSourceId}
        onSourceIdChange={onSyncSourceIdChange}
        progress={syncProgress}
        runningStatus="syncing"
        onRun={onRunSync}
        runLabel="Sinkron"
      />
    </>
  )
}
