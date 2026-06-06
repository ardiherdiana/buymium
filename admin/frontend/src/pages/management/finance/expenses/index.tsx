import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Search, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dropdown } from "@/components/ui/dropdown-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import { Fab } from "@/components/ui/fab"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface Expense {
  id: number
  category?: { id: number; name: string }
  source?: { id: number; name: string; color?: string }
  amount: number
  description?: string
  expenseDate: string
}

interface Category {
  id: number
  name: string
}

interface Source {
  id: number
  name: string
  color?: string
}

interface ExpensesResponse {
  expenses: Expense[]
  categories: Category[]
  sources: Source[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

const PAGE_SIZE = 50

const MONTH_OPTIONS = [
  { value: "all", label: "All Months" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(2024, i, 1)),
  })),
]

const YEAR_OPTIONS = Array.from({ length: 4 }, (_, i) => {
  const y = new Date().getFullYear() - i
  return { value: String(y), label: String(y) }
})

interface ExpenseForm {
  expense_date: string
  category_id: string
  source_id: string
  amount: string
}

const emptyForm: ExpenseForm = {
  expense_date: new Date().toISOString().split("T")[0],
  category_id: "",
  source_id: "",
  amount: "",
}

export default function ExpensesPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("all")
  const [sourceId, setSourceId] = useState("all")
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ExpenseForm>(emptyForm)

  const { data, isLoading } = useQuery<ExpensesResponse>({
    queryKey: ["management-expenses", page, search, categoryId, sourceId, month, year],
    queryFn: () =>
      api.get("/management/expenses", {
        params: {
          page,
          search: search || undefined,
          category_id: categoryId !== "all" ? categoryId : undefined,
          source_id: sourceId !== "all" ? sourceId : undefined,
          month: month !== "all" ? month : undefined,
          year,
        },
      }).then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: object) =>
      editingId
        ? api.put(`/management/expenses/${editingId}`, payload)
        : api.post("/management/expenses", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-expenses"] })
      alert.success("Berhasil", editingId ? "Pengeluaran berhasil diperbarui" : "Pengeluaran berhasil ditambahkan")
      setModalOpen(false)
      setEditingId(null)
      setForm(emptyForm)
    },
    onError: () => alert.error("Gagal", "Gagal menyimpan pengeluaran"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-expenses"] })
      alert.success("Berhasil", "Pengeluaran berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus pengeluaran"),
  })

  const handleDelete = async (expense: Expense) => {
    const ok = await alert.confirm("Hapus Pengeluaran", "Hapus pengeluaran ini?")
    if (ok) deleteMutation.mutate(expense.id)
  }

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id)
    setForm({
      expense_date: expense.expenseDate.split("T")[0],
      category_id: String(expense.category?.id ?? ""),
      source_id: String(expense.source?.id ?? ""),
      amount: String(expense.amount),
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
    if (!form.amount || !form.expense_date || !form.category_id) {
      alert.error("Validasi", "Tanggal, kategori, dan jumlah wajib diisi")
      return
    }
    saveMutation.mutate({
      expense_date: form.expense_date,
      category_id: form.category_id,
      source_id: form.source_id || undefined,
      amount: parseFloat(form.amount),
    })
  }

  const expenses = data?.expenses ?? []

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...(data?.categories ?? []).map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const sourceOptions = [
    { value: "all", label: "All Sources" },
    ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name })),
  ]

  const categoryFormOptions = (data?.categories ?? []).map((c) => ({ value: String(c.id), label: c.name }))
  const sourceFormOptions = [
    { value: "", label: "No Source" },
    ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name })),
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Pengeluaran</h1>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Search & Filter</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Dropdown options={categoryOptions} value={categoryId} onChange={(v) => { setCategoryId(v); setPage(1) }} className="w-full" />
            <Dropdown options={sourceOptions} value={sourceId} onChange={(v) => { setSourceId(v); setPage(1) }} className="w-full" />
            <Dropdown options={MONTH_OPTIONS} value={month} onChange={(v) => { setMonth(v); setPage(1) }} className="w-full" />
            <Dropdown options={YEAR_OPTIONS} value={year} onChange={(v) => { setYear(v); setPage(1) }} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRow colSpan={6} /> : !expenses.length ? (
                <EmptyRow colSpan={6} message="Tidak ada pengeluaran ditemukan" />
              ) : (
                expenses.map((exp, idx) => (
                  <TableRow key={exp.id}>
                    <TableCell className="text-muted-foreground text-sm">{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(exp.expenseDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>{exp.category ? <Badge variant="blue">{exp.category.name}</Badge> : "-"}</TableCell>
                    <TableCell>{exp.source ? <Badge variant="warning">{exp.source.name}</Badge> : "-"}</TableCell>
                    <TableCell className="text-right font-medium">{formatIDR(exp.amount)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(exp)}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDelete(exp)}><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
        ) : !expenses.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Tidak ada pengeluaran ditemukan</p>
        ) : (
          expenses.map((exp) => (
            <Card key={exp.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(exp.expenseDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {exp.category && <Badge variant="blue">{exp.category.name}</Badge>}
                      {exp.source && <Badge variant="warning">{exp.source.name}</Badge>}
                    </div>
                  </div>
                  <p className="font-semibold text-sm shrink-0">{formatIDR(exp.amount)}</p>
                </div>
                <div className="flex justify-end gap-1 mt-3 pt-3 border-t">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(exp)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDelete(exp)}><Trash2 className="size-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {!!expenses.length && <Pagination page={page} total={data?.pagination?.total ?? 0} pageSize={PAGE_SIZE} onChange={setPage} />}
      </div>

      <Fab onClick={handleAdd} title="Tambah Pengeluaran" />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingId(null); setForm(emptyForm) }}
        title={editingId ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Tanggal</label>
            <Input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Kategori</label>
            <Dropdown
              options={categoryFormOptions}
              value={form.category_id}
              onChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
              className="w-full"
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
          <div className="space-y-1">
            <label className="text-sm font-medium">Jumlah (Rp)</label>
            <Input
              type="number"
              placeholder="250000"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
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
