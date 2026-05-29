import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Search, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dropdown } from "@/components/ui/dropdown-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import { Fab } from "@/components/ui/fab"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface Customer {
  id: number
  username_shopee: string
  nomor_hp?: string
  source_name?: string
  source_id?: number
  creator?: { id: number; name: string }
  created_at: string
  total_profit: number
}

interface Source {
  id: number
  name: string
}

interface CustomersResponse {
  customers: Customer[]
  sources: Source[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

const PAGE_SIZE = 15

interface CustomerForm {
  username_shopee: string
  nomor_hp: string
  source_id: string
}

const emptyForm: CustomerForm = { username_shopee: "", nomor_hp: "", source_id: "" }

export default function CustomersPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [source, setSource] = useState("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ["management-customers", page, search, source],
    queryFn: () =>
      api.get("/management/customers", {
        params: { page, search: search || undefined, source: source !== "all" ? source : undefined },
      }).then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: object) =>
      editingId
        ? api.put(`/management/customers/${editingId}`, payload)
        : api.post("/management/customers", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-customers"] })
      alert.success("Berhasil", editingId ? "Pelanggan diperbarui" : "Pelanggan ditambahkan")
      setModalOpen(false)
      setEditingId(null)
      setForm(emptyForm)
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      alert.error("Gagal", err?.response?.data?.error ?? "Gagal menyimpan pelanggan"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-customers"] })
      alert.success("Berhasil", "Pelanggan berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus pelanggan"),
  })

  const handleDelete = async (c: Customer) => {
    const ok = await alert.confirm("Hapus Pelanggan", `Hapus pelanggan "${c.username_shopee}"?`)
    if (ok) deleteMutation.mutate(c.id)
  }

  const handleEdit = (c: Customer) => {
    setEditingId(c.id)
    setForm({
      username_shopee: c.username_shopee,
      nomor_hp: c.nomor_hp ?? "",
      source_id: String(c.source_id ?? ""),
    })
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username_shopee.trim()) {
      alert.error("Validasi", "Username Shopee wajib diisi")
      return
    }
    saveMutation.mutate({
      username_shopee: form.username_shopee,
      nomor_hp: form.nomor_hp || undefined,
      source_id: form.source_id || undefined,
    })
  }

  const customers = data?.customers ?? []

  const sourceOptions = [
    { value: "all", label: "All Sources" },
    ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name })),
  ]

  const sourceFormOptions = [
    { value: "", label: "No Source" },
    ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name })),
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Pelanggan</h1>
      </div>

      {/* Search + Source filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari username atau nomor HP..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Dropdown
          options={sourceOptions}
          value={source}
          onChange={(v) => { setSource(v); setPage(1) }}
          className="w-44"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">NO</TableHead>
                <TableHead>Username Shopee</TableHead>
                <TableHead>Nomor HP</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Total Profit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRow colSpan={8} /> : !customers.length ? (
                <EmptyRow colSpan={8} message="Tidak ada pelanggan ditemukan" />
              ) : (
                customers.map((c, idx) => {
                  const rank = (page - 1) * PAGE_SIZE + idx + 1
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {rank <= 2 ? (
                            <span className={`inline-flex size-6 items-center justify-center rounded text-xs font-bold text-white ${rank === 1 ? "bg-yellow-400" : "bg-slate-400"}`}>
                              {rank}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">{rank}</span>
                          )}
                          {rank <= 2 && <span className="text-yellow-500 text-sm">👑</span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{c.username_shopee}</TableCell>
                      <TableCell className="text-muted-foreground">{c.nomor_hp ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.source_name ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.creator?.name ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${c.total_profit > 0 ? "text-emerald-600" : ""}`}>
                        {formatIDR(c.total_profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(c)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(c)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          <Pagination page={page} total={data?.pagination?.total ?? 0} pageSize={PAGE_SIZE} onChange={setPage} />
        </CardContent>
      </Card>

      <Fab onClick={handleAdd} title="Tambah Pelanggan" />

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingId(null); setForm(emptyForm) }}
        title={editingId ? "Edit Pelanggan" : "Tambah Pelanggan"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Username Shopee</label>
            <Input
              placeholder="shopee_customer"
              value={form.username_shopee}
              onChange={(e) => setForm((f) => ({ ...f, username_shopee: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Nomor HP</label>
            <Input
              placeholder="081234567890"
              value={form.nomor_hp}
              onChange={(e) => setForm((f) => ({ ...f, nomor_hp: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Source</label>
            <Dropdown
              options={sourceFormOptions}
              value={form.source_id}
              onChange={(v) => setForm((f) => ({ ...f, source_id: v }))}
              className="w-full"
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
