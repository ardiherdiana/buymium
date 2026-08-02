import { useRef, useState } from "react"
import { Trash2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface BulkUploadModalProps {
  open: boolean
  onClose: () => void
  onUpload: (files: File[], source: string) => Promise<void>
  loading: boolean
}

function formatSize(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(2) + " MB"
}

export default function BulkUploadModal({ open, onClose, onUpload, loading }: BulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [source, setSource] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  const addFiles = (incoming: File[]) => setFiles((prev) => [...prev, ...incoming])

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handleSubmit = async () => {
    if (!files.length) return
    await onUpload(files, source)
    setFiles([])
    setSource("")
  }

  const handleClose = () => {
    if (loading) return
    setFiles([])
    setSource("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl p-0 gap-0 overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        <DialogHeader className="px-5 py-4 border-b flex-row items-center justify-between gap-0">
          <DialogTitle>Bulk Upload & Jadwal + AI Caption</DialogTitle>
          <Button variant="ghost" size="icon-sm" onClick={handleClose} disabled={loading}>
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ minHeight: 0 }}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Link Sumber (common)</label>
            <Input
              placeholder="cth: YouTube @ChannelName"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="text-sm h-8"
              disabled={loading}
            />
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFilePick}
            />
            <Upload className="size-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Klik atau drag & drop file di sini</p>
            <p className="text-xs text-muted-foreground mt-1">Gambar atau video, maks 200MB per file</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{files.length} file dipilih</p>
              {files.map((file, index) => (
                <div key={index} className="border rounded-lg px-3 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                    disabled={loading}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={files.length === 0 || loading}
            className="gap-2"
          >
            <Upload className="size-3.5" />
            Jadwalkan {files.length} File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
