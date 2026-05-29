import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"

interface Source {
  id: number
  name: string
  prefix?: string
  color?: string
  spreadsheet_id?: string
  index?: number
  is_accsmarket: boolean
  image_url?: string
}

interface SourceForm {
  name: string
  prefix: string
  color: string
  spreadsheet_id: string
  is_accsmarket: boolean
  image?: File | null
}

const EMPTY_FORM: SourceForm = {
  name: "",
  prefix: "",
  color: "#3b82f6",
  spreadsheet_id: "",
  is_accsmarket: false,
  image: null,
}

export default function SourcesPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<Source | null>(null)
  const [form, setForm] = useState<SourceForm>(EMPTY_FORM)
  const [dragOver, setDragOver] = useState(false)

  const { data, isLoading } = useQuery<{ sources: Source[] }>({
    queryKey: ["management-sources"],
    queryFn: () => api.get("/management/sources").then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: async ({ id, form }: { id?: number; form: SourceForm }) => {
      const fd = new FormData()
      fd.append("name", form.name)
      fd.append("spreadsheet_id", form.spreadsheet_id)
      fd.append("color", form.color)
      fd.append("prefix", form.prefix)
      fd.append("is_accsmarket", String(form.is_accsmarket))
      if (form.image) fd.append("image", form.image)
      if (id) return api.put(`/management/sources/${id}`, fd)
      return api.post("/management/sources", fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-sources"] })
      alert.success("Berhasil", editingSource ? "Source diperbarui" : "Source berhasil dibuat")
      closeModal()
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      alert.error("Gagal", err?.response?.data?.error ?? "Gagal menyimpan source")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-sources"] })
      alert.success("Berhasil", "Source berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus source"),
  })

  const openCreate = () => {
    setEditingSource(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (s: Source) => {
    setEditingSource(s)
    setForm({
      name: s.name,
      prefix: s.prefix ?? "",
      color: s.color ?? "#3b82f6",
      spreadsheet_id: s.spreadsheet_id ?? "",
      is_accsmarket: s.is_accsmarket,
      image: null,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingSource(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { alert.error("Validasi", "Nama wajib diisi"); return }
    if (!form.spreadsheet_id.trim()) { alert.error("Validasi", "Spreadsheet ID wajib diisi"); return }
    saveMutation.mutate({ id: editingSource?.id, form })
  }

  const handleDelete = async (source: Source) => {
    const ok = await alert.confirm("Hapus Source", `Hapus source "${source.name}"?`)
    if (ok) deleteMutation.mutate(source.id)
  }

  const handleImageFile = (file: File) => {
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      alert.error("Format salah", "Hanya PNG/JPG yang diizinkan")
      return
    }
    if (file.size > 5 * 1024 * 1024) { alert.error("File terlalu besar", "Maksimal 5MB"); return }
    setForm((f) => ({ ...f, image: file }))
  }

  const sources = data?.sources ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Source</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola sumber akun</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4 mr-2" />Tambah Source</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Urutan</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRow colSpan={5} /> : !sources.length ? (
                <EmptyRow colSpan={5} message="Belum ada source" />
              ) : (
                sources.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{s.index ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.color && <span className="size-3 rounded-full shrink-0" style={{ background: s.color }} />}
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{s.prefix ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_accsmarket ? "blue" : "outline"}>
                        {s.is_accsmarket ? "Accsmarket" : "Accounts"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(s)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal() }}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>{editingSource ? "Edit Source" : "Create New Source"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-[1fr_1fr] gap-5 py-2 items-stretch">
              {/* Left: image upload */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Source Image</label>
                <div
                  className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f) }}
                  onClick={() => document.getElementById("source-image-input")?.click()}
                >
                  {form.image ? (
                    <img src={URL.createObjectURL(form.image)} alt="" className="w-full h-full object-cover rounded-md" />
                  ) : editingSource?.image_url ? (
                    <img src={editingSource.image_url} alt="" className="w-full h-full object-cover rounded-md" />
                  ) : (
                    <>
                      <Upload className="size-8 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground text-center">Click to upload<br />or drag image here</p>
                    </>
                  )}
                </div>
                <input id="source-image-input" type="file" accept=".png,.jpg,.jpeg" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }} />
                <p className="text-xs text-muted-foreground">PNG, JPG (5MB max)</p>
              </div>

              {/* Right: fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Name *</label>
                  <Input placeholder="e.g., Instagram Main, TikTok Growth..." value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Prefix</label>
                  <Input placeholder="e.g., IG, TT, FB (2-3 chars)" value={form.prefix}
                    onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="size-10 rounded cursor-pointer border p-0.5" />
                    <Input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="font-mono w-32" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Spreadsheet ID *</label>
                  <Input placeholder="Google Sheets ID..." value={form.spreadsheet_id}
                    onChange={(e) => setForm((f) => ({ ...f, spreadsheet_id: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Optional - for Google Sheets integration</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Type</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={!form.is_accsmarket ? "default" : "outline"}
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, is_accsmarket: false }))}
                    >
                      Accounts
                    </Button>
                    <Button
                      type="button"
                      variant={form.is_accsmarket ? "default" : "outline"}
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, is_accsmarket: true }))}
                    >
                      Accsmarket
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {form.is_accsmarket ? "Source ini untuk data accsmarket" : "Source ini untuk data accounts"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                <Plus className="size-4 mr-1.5" />
                {saveMutation.isPending ? "Menyimpan..." : editingSource ? "Update Source" : "Create Source"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
