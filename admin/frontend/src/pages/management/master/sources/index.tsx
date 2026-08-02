import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import { Fab } from "@/components/ui/fab"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"

interface Source {
  id: number
  name: string
  spreadsheetId: string
}

interface SourcesResponse {
  sources: Source[]
}

interface SourceForm {
  name: string
  spreadsheet_id: string
}

const emptyForm: SourceForm = { name: "", spreadsheet_id: "" }

export default function SourcesPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<SourceForm>(emptyForm)

  const { data, isLoading } = useQuery<SourcesResponse>({
    queryKey: ["management-sources"],
    queryFn: () => api.get("/management/sources").then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: object) =>
      editingId
        ? api.put(`/management/sources/${editingId}`, payload)
        : api.post("/management/sources", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-sources"] })
      alert.success("Berhasil", editingId ? "Source diperbarui" : "Source ditambahkan")
      setModalOpen(false)
      setEditingId(null)
      setForm(emptyForm)
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      alert.error("Gagal", err?.response?.data?.error ?? "Gagal menyimpan source"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-sources"] })
      alert.success("Berhasil", "Source berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus source"),
  })

  const handleDelete = async (s: Source) => {
    const ok = await alert.confirm("Hapus Source", `Hapus source "${s.name}"? Akun yang masih terhubung akan kehilangan source-nya.`)
    if (ok) deleteMutation.mutate(s.id)
  }

  const handleEdit = (s: Source) => {
    setEditingId(s.id)
    setForm({ name: s.name, spreadsheet_id: s.spreadsheetId })
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.spreadsheet_id.trim()) {
      alert.error("Validasi", "Nama dan Spreadsheet ID wajib diisi")
      return
    }
    saveMutation.mutate({
      name: form.name.trim(),
      spreadsheet_id: form.spreadsheet_id.trim(),
    })
  }

  const sources = data?.sources ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Source</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola source spreadsheet untuk sync stok akun</p>
      </div>

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Spreadsheet ID</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRow colSpan={3} /> : !sources.length ? (
                <EmptyRow colSpan={3} message="Belum ada source" />
              ) : (
                sources.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{s.spreadsheetId}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(s)}><Pencil className="size-4" /></Button>
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
              <CardContent className="p-4 space-y-2">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{s.spreadsheetId}</p>
                <div className="flex justify-end gap-1 pt-2 border-t">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(s)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s)}><Trash2 className="size-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Fab onClick={handleAdd} title="Tambah Source" />

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingId(null); setForm(emptyForm) }}
        title={editingId ? "Edit Source" : "Tambah Source"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nama</label>
            <Input
              placeholder="MUDA"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Spreadsheet ID</label>
            <Input
              placeholder="1yDtHt2EAFDGA0gkg3xRLrzv_-XhtyMXAQxU7r0x53Ks"
              value={form.spreadsheet_id}
              onChange={(e) => setForm((f) => ({ ...f, spreadsheet_id: e.target.value }))}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { setModalOpen(false); setEditingId(null); setForm(emptyForm) }}
            >
              Batal
            </Button>
            <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
