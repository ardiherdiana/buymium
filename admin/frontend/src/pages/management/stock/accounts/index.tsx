import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Search, RefreshCw, Sheet, Users, ArrowLeft, Heart, Target, CheckCircle2, Trash2, Copy, ScanLine, ShoppingCart, ClipboardList } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dropdown } from "@/components/ui/dropdown-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAlert } from "@/stores/alertStore"
import { useNavigate } from "react-router"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface Account {
  id: number
  username?: string
  email?: string
  password?: string
  currentFollowers?: number
  targetFollowers?: number
  accountStatus: string
  loginApp?: string
  capital?: number
  phoneModel?: string
  source?: { id: number; name: string }
  isSold: boolean
}


interface Source {
  id: number
  name: string
}

interface AccountsResponse {
  accounts: Account[]
  sources: Source[]
  phoneModels: string[]
  targetFollowers: number[]
  pagination: { page: number; limit: number; total: number; pages: number }
  stats: {
    total_accounts: number
    total_followers: number
    target_followers: number
    completed_accounts: number
  }
}

const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "Completed", label: "Selesai" },
  { value: "Progress", label: "Proses" },
  { value: "Error", label: "Error" },
]

const PAGE_SIZE = 100

function formatFollowersLabel(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}


export default function AccountsPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [sourceId, setSourceId] = useState("all")
  const [phoneModel, setPhoneModel] = useState("all")
  const [targetFollowers, setTargetFollowers] = useState("all")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncSourceId, setSyncSourceId] = useState("all")
  const [syncProgress, setSyncProgress] = useState<{
    status: "idle" | "syncing" | "done" | "error"
    current: number; total: number; sourceNames: string[]; error?: string
  }>({ status: "idle", current: 0, total: 0, sourceNames: [] })

  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [scanSourceId, setScanSourceId] = useState("all")
  const [scanProgress, setScanProgress] = useState<{
    status: "idle" | "scanning" | "done" | "error"
    current: number; total: number; sourceNames: string[]; error?: string
  }>({ status: "idle", current: 0, total: 0, sourceNames: [] })

  const { data, isLoading } = useQuery<AccountsResponse>({
    queryKey: ["management-accounts", page, search, status, sourceId, phoneModel, targetFollowers],
    queryFn: () =>
      api.get("/management/accounts", {
        params: {
          page,
          search: search || undefined,
          status: status !== "all" ? status : undefined,
          source_id: sourceId !== "all" ? sourceId : undefined,
          phone_model: phoneModel !== "all" ? phoneModel : undefined,
          target_followers: targetFollowers !== "all" ? targetFollowers : undefined,
        },
      }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-accounts"] })
      alert.success("Berhasil", "Akun berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus akun"),
  })

  const refreshMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/accounts/${id}/refresh-followers`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-accounts"] })
    },
    onError: () => alert.error("Gagal", "Gagal memperbarui followers"),
  })

  // ── Scan selected ──────────────────────────────────────────────────────────
  const handleBulkScan = async () => {
    const toScan = (data?.accounts ?? []).filter((a) => selectedIds.includes(a.id))
    if (!toScan.length) return
    for (const acc of toScan) {
      try { await api.post(`/management/accounts/${acc.id}/refresh-followers`) } catch { /* continue */ }
    }
    queryClient.invalidateQueries({ queryKey: ["management-accounts"] })
    alert.success("Selesai", `${toScan.length} akun berhasil di-scan`)
  }

  // ── Copy credentials ───────────────────────────────────────────────────────
  const handleBulkCopy = () => {
    const accs = (data?.accounts ?? []).filter((a) => selectedIds.includes(a.id))
    if (!accs.length) return
    const lines = accs.map((acc, i) => {
      const parts: string[] = []
      if (acc.email) parts.push(`Email: ${acc.email}`)
      if (acc.username) parts.push(`Username: ${acc.username}`)
      if (acc.password) parts.push(`Password: ${acc.password}`)
      return `${i + 1}. ${parts.join("\n   ")}`
    })
    navigator.clipboard.writeText(lines.join("\n\n"))
    alert.success("Disalin", `${accs.length} akun disalin ke clipboard`)
  }

  // ── Copy available stock (all completed accounts, grouped by target) ──────
  const copyStockMutation = useMutation({
    mutationFn: () =>
      api.get("/management/accounts/export/completed", {
        params: {
          source_id: sourceId !== "all" ? sourceId : undefined,
          phone_model: phoneModel !== "all" ? phoneModel : undefined,
          target_followers: targetFollowers !== "all" ? targetFollowers : undefined,
          search: search || undefined,
        },
      }).then((r) => r.data as { accounts: { username: string | null; targetFollowers: number | null }[] }),
    onSuccess: (result) => {
      const accs = result.accounts.filter((a) => a.username)
      if (!accs.length) {
        alert.error("Kosong", "Tidak ada akun selesai yang tersedia")
        return
      }
      const groups = new Map<number, string[]>()
      for (const acc of accs) {
        const target = acc.targetFollowers ?? 0
        if (!groups.has(target)) groups.set(target, [])
        groups.get(target)!.push(acc.username as string)
      }
      const sortedTargets = [...groups.keys()].sort((a, b) => a - b)
      const currentYear = new Date().getFullYear()
      const blocks = sortedTargets.map((target) => {
        const label = formatFollowersLabel(target)
        const usernames = groups.get(target)!
        return `=== AKUN ${label} FOLLOWERS ${currentYear} (${usernames.length} Stok) ===\n${usernames.join("\n")}`
      })
      navigator.clipboard.writeText(blocks.join("\n\n"))
      alert.success("Disalin", `${accs.length} akun stok disalin ke clipboard`)
    },
    onError: () => alert.error("Gagal", "Gagal mengambil stok akun"),
  })

  // ── Delete selected ────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    const ok = await alert.confirm("Hapus Akun", `Hapus ${selectedIds.length} akun yang dipilih?`)
    if (!ok) return
    await Promise.all(selectedIds.map((id) => api.delete(`/management/accounts/${id}`).catch(() => {})))
    queryClient.invalidateQueries({ queryKey: ["management-accounts"] })
    alert.success("Berhasil", `${selectedIds.length} akun dihapus`)
    setSelectedIds([])
  }

  const runSync = async () => {
    const sources = data?.sources ?? []
    const toSync = syncSourceId === "all" ? sources : sources.filter((s) => String(s.id) === syncSourceId)
    const isSingleCall = syncSourceId !== "all" || toSync.length === 0
    if (isSingleCall) {
      setSyncProgress({ status: "syncing", current: 0, total: 1, sourceNames: [toSync[0]?.name ?? "All"] })
      try {
        await api.post("/management/accounts/sync", { source_id: syncSourceId !== "all" ? syncSourceId : undefined })
        setSyncProgress((p) => ({ ...p, status: "done", current: 1 }))
        queryClient.invalidateQueries({ queryKey: ["management-accounts"] })
      } catch (err: unknown) {
        setSyncProgress((p) => ({ ...p, status: "error", error: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal" }))
      }
      return
    }
    setSyncProgress({ status: "syncing", current: 0, total: toSync.length, sourceNames: toSync.map((s) => s.name) })
    for (let i = 0; i < toSync.length; i++) {
      try { await api.post("/management/accounts/sync", { source_id: String(toSync[i].id) }) } catch { /* continue */ }
      setSyncProgress((p) => ({ ...p, current: i + 1 }))
    }
    setSyncProgress((p) => ({ ...p, status: "done" }))
    queryClient.invalidateQueries({ queryKey: ["management-accounts"] })
  }

  const runScan = async () => {
    const sourceParam = scanSourceId !== "all" ? scanSourceId : undefined
    setScanProgress({ status: "scanning", current: 0, total: 0, sourceNames: [] })
    let accountIds: number[] = []
    try {
      const list = await api.get("/management/accounts/scan/list", { params: { source_id: sourceParam } })
      accountIds = (list.data?.accounts ?? []).map((a: { id: number }) => a.id)
    } catch (err: unknown) {
      setScanProgress((p) => ({ ...p, status: "error", error: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal" }))
      return
    }
    setScanProgress((p) => ({ ...p, total: accountIds.length }))
    for (let i = 0; i < accountIds.length; i++) {
      try { await api.post(`/management/accounts/${accountIds[i]}/refresh-followers`) } catch { /* continue */ }
      setScanProgress((p) => ({ ...p, current: i + 1 }))
    }
    setScanProgress((p) => ({ ...p, status: "done" }))
    queryClient.invalidateQueries({ queryKey: ["management-accounts"] })
  }

  const handleDelete = async (acc: Account) => {
    const ok = await alert.confirm("Hapus Akun", `Hapus akun "${acc.username ?? acc.email}"?`)
    if (ok) deleteMutation.mutate(acc.id)
  }

  const accounts = data?.accounts ?? []
  const stats = data?.stats

  const sourceOptions = [
    { value: "all", label: "Semua Source" },
    ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name })),
  ]
  const phoneModelOptions = [
    { value: "all", label: "Semua Model" },
    ...(data?.phoneModels ?? []).map((m) => ({ value: m, label: m })),
  ]
  const targetFollowersOptions = [
    { value: "all", label: "Semua Target" },
    ...(data?.targetFollowers ?? []).map((f) => ({ value: String(f), label: f.toLocaleString("id-ID") })),
  ]

  const allIds = accounts.map((a) => a.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))
  const toggleAll = () => setSelectedIds(allSelected ? [] : allIds)
  const toggleOne = (id: number) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const completedCount = stats?.completed_accounts ?? 0
  const totalCount = stats?.total_accounts ?? 0

  return (
    <div>
      <div className={`space-y-5 ${selectedIds.length > 0 ? "pb-20 sm:pb-24" : ""}`}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold">Kelola Akun</h1>
        </div>

        {/* Stats */}
        {/* Mobile: compact single-line rows */}
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          {[
            { label: "Total Akun", value: totalCount.toLocaleString("id-ID"), icon: Users, color: "text-blue-600" },
            { label: "Total Followers", value: (stats?.total_followers ?? 0).toLocaleString("id-ID"), icon: Heart, color: "text-red-500" },
            { label: "Target Followers", value: (stats?.target_followers ?? 0).toLocaleString("id-ID"), icon: Target, color: "text-blue-600" },
            { label: "Selesai", value: `${completedCount.toLocaleString("id-ID")}/${totalCount.toLocaleString("id-ID")}`, icon: CheckCircle2, color: "text-emerald-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{label}</p>
                  <p className="text-base font-bold leading-tight">{value}</p>
                </div>
                <Icon className={`size-5 shrink-0 ${color}`} />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Desktop: original cards */}
        <div className="hidden sm:grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Akun</p>
                <p className="text-2xl font-bold mt-1">{totalCount.toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground">Akun aktif</p>
              </div>
              <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="size-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Followers</p>
                <p className="text-2xl font-bold mt-1">{(stats?.total_followers ?? 0).toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground">Gabungan followers</p>
              </div>
              <div className="size-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Heart className="size-5 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Target Followers</p>
                <p className="text-2xl font-bold mt-1">{(stats?.target_followers ?? 0).toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground">Total target</p>

              </div>
              <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Target className="size-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Akun Selesai</p>
                <p className="text-2xl font-bold mt-1">{completedCount.toLocaleString("id-ID")}/{totalCount.toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground">Akun selesai</p>
              </div>
              <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Cari & Filter</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari email atau username..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Source</p>
                <Dropdown options={sourceOptions} value={sourceId} onChange={(v) => { setSourceId(v); setPage(1) }} className="w-full" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Status</p>
                <Dropdown options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1) }} className="w-full" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Model HP</p>
                <Dropdown options={phoneModelOptions} value={phoneModel} onChange={(v) => { setPhoneModel(v); setPage(1) }} className="w-full" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Target Followers</p>
                <Dropdown options={targetFollowersOptions} value={targetFollowers} onChange={(v) => { setTargetFollowers(v); setPage(1) }} className="w-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => { setScanSourceId("all"); setScanProgress({ status: "idle", current: 0, total: 0, sourceNames: [] }); setScanDialogOpen(true) }}
            disabled={scanProgress.status === "scanning" || syncProgress.status === "syncing"}
          >
            <RefreshCw className={`size-4 ${scanProgress.status === "scanning" ? "animate-spin" : ""}`} />
            {scanProgress.status === "scanning" ? "Memindai..." : "Scan Followers"}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => { setSyncSourceId("all"); setSyncProgress({ status: "idle", current: 0, total: 0, sourceNames: [] }); setSyncDialogOpen(true) }}
            disabled={syncProgress.status === "syncing" || scanProgress.status === "scanning"}
          >
            <Sheet className={`size-4 ${syncProgress.status === "syncing" ? "animate-spin" : ""}`} />
            {syncProgress.status === "syncing" ? "Menyinkronkan..." : "Sync Sheets"}
          </Button>
          <Button
            variant="outline"
            className="w-full col-span-2 gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
            onClick={() => copyStockMutation.mutate()}
            disabled={copyStockMutation.isPending}
          >
            <ClipboardList className="size-4" />
            {copyStockMutation.isPending ? "Menyalin..." : "Salin Stok"}
          </Button>
        </div>

        {/* Desktop: table */}
        <Card className="overflow-hidden p-0 hidden sm:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Saat Ini</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aplikasi Login</TableHead>
                  <TableHead>Modal</TableHead>
                  <TableHead>HP</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRow colSpan={11} /> : !accounts.length ? (
                  <EmptyRow colSpan={11} message="Tidak ada akun ditemukan." />
                ) : (
                  accounts.map((acc) => (
                    <TableRow key={acc.id} className={selectedIds.includes(acc.id) ? "bg-muted/40" : ""}>
                      <TableCell>
                        <Checkbox checked={selectedIds.includes(acc.id)} onCheckedChange={() => toggleOne(acc.id)} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.email ?? "-"}</TableCell>
                      <TableCell className="font-medium text-sm">{acc.username ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.password ?? "-"}</TableCell>
                      <TableCell>{acc.currentFollowers?.toLocaleString("id-ID") ?? "-"}</TableCell>
                      <TableCell>{acc.targetFollowers?.toLocaleString("id-ID") ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={acc.accountStatus?.toLowerCase() === "completed" ? "completed" : acc.accountStatus?.toLowerCase() === "error" ? "destructive" : "progress"}>
                          {acc.accountStatus?.toLowerCase() === "completed" ? "Selesai" : acc.accountStatus?.toLowerCase() === "error" ? "Error" : "Proses"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.loginApp ?? "-"}</TableCell>
                      <TableCell>{acc.capital ? formatIDR(acc.capital) : "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.phoneModel ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="size-8 text-blue-600 hover:text-blue-700"
                            onClick={() => refreshMutation.mutate(acc.id)}
                            disabled={refreshMutation.isPending}
                          >
                            <RefreshCw className="size-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(acc)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
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
          ) : !accounts.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada akun ditemukan.</p>
          ) : (
            accounts.map((acc) => (
              <Card key={acc.id} className={selectedIds.includes(acc.id) ? "ring-2 ring-primary" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox checked={selectedIds.includes(acc.id)} onCheckedChange={() => toggleOne(acc.id)} className="shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{acc.username ?? "-"}</p>
                        <p className="text-xs text-muted-foreground truncate">{acc.email ?? "-"}</p>
                      </div>
                    </div>
                    <Badge variant={acc.accountStatus?.toLowerCase() === "completed" ? "completed" : acc.accountStatus?.toLowerCase() === "error" ? "destructive" : "progress"} className="shrink-0">
                      {acc.accountStatus?.toLowerCase() === "completed" ? "Selesai" : acc.accountStatus?.toLowerCase() === "error" ? "Error" : "Proses"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Followers</span>
                      <span className="font-medium">{acc.currentFollowers?.toLocaleString("id-ID") ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target</span>
                      <span className="font-medium">{acc.targetFollowers?.toLocaleString("id-ID") ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modal</span>
                      <span className="font-medium">{acc.capital ? formatIDR(acc.capital) : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">HP</span>
                      <span className="font-medium truncate">{acc.phoneModel ?? "-"}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">{acc.loginApp ?? "-"}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost" size="icon" className="size-8 text-blue-600 hover:text-blue-700"
                        onClick={() => refreshMutation.mutate(acc.id)}
                        disabled={refreshMutation.isPending}
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(acc)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          {!!accounts.length && (
            <Pagination page={page} total={data?.pagination?.total ?? 0} pageSize={PAGE_SIZE} onChange={setPage} />
          )}
        </div>
      </div>

      {/* ── Floating Bulk Action Bar ──────────────────────────────────────── */}
      {selectedIds.length > 0 && (
        <>
          {/* Mobile: full-width bottom bar */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-background border-t shadow-2xl px-4 pt-2 pb-3 flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">{selectedIds.length} akun dipilih</span>
            <div className="flex items-center gap-2">
              <Button size="sm" className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate("/stock/accounts/pos", { state: { selectedIds } })}>
                <ShoppingCart className="size-3.5" />
                Terjual
              </Button>
              <Button size="sm" className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkScan}>
                <ScanLine className="size-3.5" />
                Pindai
              </Button>
              <Button size="sm" className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkCopy}>
                <Copy className="size-3.5" />
                Salin
              </Button>
              <Button size="sm" variant="destructive" className="flex-1 gap-1.5" onClick={handleBulkDelete}>
                <Trash2 className="size-3.5" />
                Hapus
              </Button>
            </div>
          </div>
          {/* Desktop: centered floating pill */}
          <div className="hidden sm:flex fixed bottom-4 left-1/2 -translate-x-1/2 z-20 bg-background border rounded-lg shadow-2xl px-4 py-3 items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground mr-1">{selectedIds.length} akun</span>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate("/stock/accounts/pos", { state: { selectedIds } })}>
              <ShoppingCart className="size-3.5" />
              Terjual
            </Button>
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkScan}>
              <ScanLine className="size-3.5" />
              Pindai
            </Button>
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkCopy}>
              <Copy className="size-3.5" />
              Salin
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleBulkDelete}>
              <Trash2 className="size-3.5" />
              Hapus
            </Button>
          </div>
        </>
      )}

      {/* Scan Dialog */}
      <Dialog open={scanDialogOpen} onOpenChange={(open) => { if (scanProgress.status === "scanning") return; setScanDialogOpen(open) }}>
        <DialogContent className="max-w-md">
          {scanProgress.status === "idle" ? (
            <>
              <DialogHeader><DialogTitle>Scan Followers</DialogTitle></DialogHeader>
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">Source</p>
                <Dropdown options={[{ value: "all", label: "Semua Source" }, ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name }))]} value={scanSourceId} onChange={setScanSourceId} className="w-full" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setScanDialogOpen(false)}>Batal</Button>
                <Button onClick={runScan}>Pindai</Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className={`size-5 ${scanProgress.status === "scanning" ? "animate-spin" : ""}`} />
                  Scan Followers
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-sm"><span>Progress</span><span className="text-muted-foreground">{scanProgress.current} / {scanProgress.total || "..."}</span></div>
                <div className="h-2 w-full bg-secondary overflow-hidden rounded">
                  <div className="h-full bg-foreground transition-all" style={{ width: scanProgress.total > 0 ? `${(scanProgress.current / scanProgress.total) * 100}%` : "0%" }} />
                </div>
              </div>
              {scanProgress.status === "done" && <div className="rounded bg-emerald-50 border border-emerald-200 px-4 py-3"><p className="text-sm font-medium text-emerald-700">Pemindaian selesai!</p></div>}
              {scanProgress.status === "error" && <div className="rounded bg-destructive/10 border border-destructive/20 px-4 py-3"><p className="text-sm font-medium text-destructive">{scanProgress.error}</p></div>}
              {(scanProgress.status === "done" || scanProgress.status === "error") && <div className="flex justify-end"><Button variant="outline" onClick={() => setScanDialogOpen(false)}>Tutup</Button></div>}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={(open) => { if (syncProgress.status === "syncing") return; setSyncDialogOpen(open) }}>
        <DialogContent className="max-w-md">
          {syncProgress.status === "idle" ? (
            <>
              <DialogHeader><DialogTitle>Sync with Google Sheets</DialogTitle></DialogHeader>
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">Source</p>
                <Dropdown options={[{ value: "all", label: "Semua Source" }, ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name }))]} value={syncSourceId} onChange={setSyncSourceId} className="w-full" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>Batal</Button>
                <Button onClick={runSync}>Sinkron</Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className={`size-5 ${syncProgress.status === "syncing" ? "animate-spin" : ""}`} />
                  Sync Google Sheets
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-sm"><span>Progress</span><span className="text-muted-foreground">{syncProgress.current} / {syncProgress.total}</span></div>
                <div className="h-2 w-full bg-secondary overflow-hidden rounded">
                  <div className="h-full bg-foreground transition-all" style={{ width: syncProgress.total > 0 ? `${(syncProgress.current / syncProgress.total) * 100}%` : "0%" }} />
                </div>
              </div>
              {syncProgress.status === "done" && <div className="rounded bg-emerald-50 border border-emerald-200 px-4 py-3"><p className="text-sm font-medium text-emerald-700">Sinkronisasi selesai!</p></div>}
              {syncProgress.status === "error" && <div className="rounded bg-destructive/10 border border-destructive/20 px-4 py-3"><p className="text-sm font-medium text-destructive">{syncProgress.error}</p></div>}
              {(syncProgress.status === "done" || syncProgress.status === "error") && <div className="flex justify-end"><Button variant="outline" onClick={() => setSyncDialogOpen(false)}>Tutup</Button></div>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
