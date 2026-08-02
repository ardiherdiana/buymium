"use client"

import { useRef, useState } from "react"
import { CheckCircle2, FileImage, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

export function UploadZone({ onFile, uploading, success }: {
  onFile: (f: File) => void
  uploading: boolean
  success: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  function pickFile(f: File) {
    setSelectedFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
    if (ref.current) ref.current.value = ""
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
        <CheckCircle2 className="size-8 text-green-400" />
        <p className="text-sm font-medium text-green-400">Bukti berhasil dikirim!</p>
        <p className="text-xs text-muted-foreground">Admin sedang memverifikasi pembayaranmu.</p>
      </div>
    )
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
      />
      {selectedFile ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 text-center">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview bukti transfer" className="max-h-48 rounded-lg border object-contain" />
          )}
          <p className="text-sm font-medium">{selectedFile.name}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={clearFile} disabled={uploading}>
              Ganti File
            </Button>
            <Button size="sm" onClick={() => onFile(selectedFile)} disabled={uploading}>
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {uploading ? "Mengirim..." : "Kirim Bukti"}
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => ref.current?.click()}
          className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FileImage className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Upload Bukti Transfer</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Klik atau drag & drop gambar ke sini · JPG, PNG, WEBP
            </p>
          </div>
          <Button size="sm" variant="outline" className="pointer-events-none">
            <Upload className="size-3.5" />
            Pilih File
          </Button>
        </div>
      )}
    </>
  )
}
