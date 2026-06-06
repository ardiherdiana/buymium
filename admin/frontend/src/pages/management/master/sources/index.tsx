import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2 } from "lucide-react"
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
  spreadsheet_id?: string
  index?: number
  is_accsmarket: boolean
}

interface SourceForm {
  name: string
  spreadsheet_id: string
  is_accsmarket: boolean
}

const EMPTY_FORM: SourceForm = {
  name: "",
  spreadsheet_id: "",
  is_accsmarket: false,
}

export default function SourcesPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<Source | null>(null)
  const [form, setForm] = useState<SourceForm>(EMPTY_FORM)

  const { data, isLoading } = useQuery<{ sources: Source[] }>({
    queryKey: ["management-sources"],
    queryFn: () => api.get("/management/sources").then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: async ({ id, form }: { id?: number; form: SourceForm }) => {
      const payload = {
        name: form.name,
        spreadsheet_id: form.spreadsheet_id,
        is_accsmarket: form.is_accsmarket,
      }
      if (id) return api.put(`/management/sources/${id}`, payload)
      return api.post("/management/sources", payload)
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
      spreadsheet_id: s.spreadsheet_id ?? "",
      is_accsmarket: s.is_accsmarket,
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

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Urutan</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRow colSpan={4} /> : !sources.length ? (
                <EmptyRow colSpan={4} message="Belum ada source" />
              ) : (
                sources.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{s.index ?? "-"}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_accsmarket ? "blue" : "outline"}>
                        {s.is_accsmarket ? "Accsmarket" : "Accounts"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(s)}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s)}><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
        ) : !sources.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada source</p>
        ) : (
          sources.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <Badge variant={s.is_accsmarket ? "blue" : "outline"} className="text-xs mt-0.5">
                      {s.is_accsmarket ? "Accsmarket" : "Accounts"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(s)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal() }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingSource ? "Edit Source" : "Tambah Source"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nama *</label>
              <Input placeholder="e.g., Instagram Main, Accsmarket Pro..." value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Spreadsheet ID *</label>
              <Input placeholder="Google Sheets ID..." value={form.spreadsheet_id}
                onChange={(e) => setForm((f) => ({ ...f, spreadsheet_id: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Untuk integrasi Google Sheets</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipe</label>
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

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeModal}>Batal</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Menyimpan..." : editingSource ? "Update" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
