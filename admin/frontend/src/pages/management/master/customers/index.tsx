import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Search, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import { Fab } from "@/components/ui/fab"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"
import { useDebounce } from "@/hooks/use-debounce"

interface Customer {
  id: number
  username_shopee: string
  nomor_hp?: string
  creator?: { id: number; name: string }
  created_at: string
  total_profit: number
}

interface CustomersResponse {
  customers: Customer[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

const PAGE_SIZE = 15

interface CustomerForm {
  username_shopee: string
  nomor_hp: string
}

const emptyForm: CustomerForm = { username_shopee: "", nomor_hp: "" }

export default function CustomersPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)
  const debouncedUsername = useDebounce(form.username_shopee.trim(), 400)

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ["management-customers", page, search],
    queryFn: () =>
      api.get("/management/customers", {
        params: { page, search: search || undefined },
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

  const { data: duplicateData, isFetching: checkingDuplicate } = useQuery<{ id: number; username_shopee: string } | null>({
    queryKey: ["customer-duplicate-check", debouncedUsername, editingId],
    queryFn: () =>
      api.get("/management/customers/check-duplicate", {
        params: { username_shopee: debouncedUsername, exclude_id: editingId ?? undefined },
      })
        .then((r) => (r.data?.exists ? r.data.customer : null))
        .catch(() => null),
    enabled: !!debouncedUsername,
  })
  const duplicate = debouncedUsername ? (duplicateData ?? null) : null

  const handleDelete = async (c: Customer) => {
    const ok = await alert.confirm("Hapus Pelanggan", `Hapus pelanggan "${c.username_shopee}"?`)
    if (ok) deleteMutation.mutate(c.id)
  }

  const handleEdit = (c: Customer) => {
    setEditingId(c.id)
    setForm({
      username_shopee: c.username_shopee,
      nomor_hp: c.nomor_hp ?? "",
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
    if (!form.username_shopee.trim() && !form.nomor_hp.trim()) {
      alert.error("Validasi", "Username Shopee atau Nomor HP wajib diisi salah satu")
      return
    }
    if (duplicate) {
      alert.error("Validasi", "Username Shopee ini sudah dipakai pelanggan lain")
      return
    }
    saveMutation.mutate({
      username_shopee: form.username_shopee.trim() || undefined,
      nomor_hp: form.nomor_hp || undefined,
    })
  }

  const customers = data?.customers ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Pelanggan</h1>
      </div>

      {/* Search */}
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
      </div>

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">NO</TableHead>
                <TableHead>Username Shopee</TableHead>
                <TableHead>Nomor HP</TableHead>
                <TableHead>Dibuat Oleh</TableHead>
                <TableHead>Tanggal Dibuat</TableHead>
                <TableHead className="text-right">Total Profit</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRow colSpan={7} /> : !customers.length ? (
                <EmptyRow colSpan={7} message="Tidak ada pelanggan ditemukan" />
              ) : (
                customers.map((c, idx) => {
                  const rank = (page - 1) * PAGE_SIZE + idx + 1
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {rank <= 2 ? (
                            <span className={`inline-flex size-6 items-center justify-center rounded text-xs font-bold text-white ${rank === 1 ? "bg-yellow-400" : "bg-slate-400"}`}>{rank}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">{rank}</span>
                          )}
                          {rank <= 2 && <span className="text-yellow-500 text-sm">👑</span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{c.username_shopee}</TableCell>
                      <TableCell className="text-muted-foreground">{c.nomor_hp ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.creator?.name ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${c.total_profit > 0 ? "text-emerald-600" : ""}`}>{formatIDR(c.total_profit)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(c)}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c)}><Trash2 className="size-4" /></Button>
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

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
        ) : !customers.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Tidak ada pelanggan ditemukan</p>
        ) : (
          customers.map((c, idx) => {
            const rank = (page - 1) * PAGE_SIZE + idx + 1
            return (
              <Card key={c.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {rank <= 2 ? (
                        <span className={`inline-flex size-5 items-center justify-center rounded text-xs font-bold text-white shrink-0 ${rank === 1 ? "bg-yellow-400" : "bg-slate-400"}`}>{rank}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">{rank}</span>
                      )}
                      <p className="font-medium text-sm truncate">{c.username_shopee}</p>
                    </div>
                    <p className={`text-sm font-semibold shrink-0 ${c.total_profit > 0 ? "text-emerald-600" : ""}`}>{formatIDR(c.total_profit)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{c.nomor_hp ?? "-"}</span>
                    <span>{c.creator?.name ?? "-"}</span>
                    <span>{new Date(c.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                  <div className="flex justify-end gap-1 pt-2 border-t">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(c)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c)}><Trash2 className="size-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
        {!!customers.length && <Pagination page={page} total={data?.pagination?.total ?? 0} pageSize={PAGE_SIZE} onChange={setPage} />}
      </div>

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
              className={duplicate ? "border-destructive focus-visible:ring-destructive" : undefined}
            />
            {checkingDuplicate && (
              <p className="text-xs text-muted-foreground">Memeriksa...</p>
            )}
            {!checkingDuplicate && duplicate && (
              <p className="text-xs text-destructive">
                Pelanggan sudah ada dengan username ini (ID #{duplicate.id})
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Nomor HP</label>
            <Input
              placeholder="081234567890"
              value={form.nomor_hp}
              onChange={(e) => setForm((f) => ({ ...f, nomor_hp: e.target.value }))}
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
            <Button type="submit" className="flex-1" disabled={saveMutation.isPending || checkingDuplicate || !!duplicate}>
              {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
