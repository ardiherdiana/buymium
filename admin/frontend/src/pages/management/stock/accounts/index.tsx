import { useState, useEffect, useRef, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Search, History, RefreshCw, Sheet, Users, ArrowLeft, Heart, Target, CheckCircle2, Trash2, Copy, ScanLine, ShoppingCart } from "lucide-react"
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
import AccountsPos from "./pos"

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

interface Customer {
  id: number
  usernameSh?: string
  nomorHp?: string
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
  { value: "all", label: "All Status" },
  { value: "Completed", label: "Completed" },
  { value: "Progress", label: "Progress" },
  { value: "Warming", label: "Warming" },
  { value: "Error", label: "Error" },
]

const PAGE_SIZE = 100

const formatCurrency = (n: number | null) => {
  if (n === null || n === undefined) return "-"
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
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
  const [posModalOpen, setPosModalOpen] = useState(false)

  // POS state (lifted up)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState("")
  const [customerSearchQuery, setCustomerSearchQuery] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [isShopee, setIsShopee] = useState(false)
  const [shopeeOrderNumber, setShopeeOrderNumber] = useState("")
  const [totalSalesInput, setTotalSalesInput] = useState("")
  const [submittingSale, setSubmittingSale] = useState(false)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

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

  // Load customers on mount
  useEffect(() => {
    api.get("/management/accounts/search/customers").then((r) => {
      setCustomers(r.data?.customers ?? [])
    }).catch(() => {})
  }, [])

  // Customer search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      if (customerSearchQuery) {
        api.get("/management/accounts/search/customers", { params: { search: customerSearchQuery } }).then((r) => {
          setCustomers(r.data?.customers ?? [])
        }).catch(() => {})
      }
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearchQuery])

  // Click outside customer dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }
    if (showCustomerDropdown) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showCustomerDropdown])

  const unitPrice = useMemo(() => {
    if (!totalSalesInput || selectedIds.length === 0) return 0
    return Math.floor(parseInt(totalSalesInput.replace(/\D/g, "") || "0") / selectedIds.length)
  }, [totalSalesInput, selectedIds.length])

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

  // ── Delete selected ────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    const ok = await alert.confirm("Hapus Akun", `Hapus ${selectedIds.length} akun yang dipilih?`)
    if (!ok) return
    await Promise.all(selectedIds.map((id) => api.delete(`/management/accounts/${id}`).catch(() => {})))
    queryClient.invalidateQueries({ queryKey: ["management-accounts"] })
    alert.success("Berhasil", `${selectedIds.length} akun dihapus`)
    setSelectedIds([])
  }

  // ── Submit sale ────────────────────────────────────────────────────────────
  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomerId) { alert.error("Validasi", "Pilih customer"); return }
    if (selectedIds.length === 0) { alert.error("Validasi", "Pilih akun"); return }
    if (!totalSalesInput.trim()) { alert.error("Validasi", "Masukkan harga jual"); return }
    setSubmittingSale(true)
    try {
      const selectedAccounts = (data?.accounts ?? []).filter((a) => selectedIds.includes(a.id))
      const totalSalePrice = parseInt(totalSalesInput.replace(/\D/g, "") || "0")
      const unitPriceCalc = totalSalePrice / selectedAccounts.length
      const totalProfit = selectedAccounts.reduce((s, a) => s + (unitPriceCalc - (a.capital ?? 0)), 0)
      const salesNumber = `SAL-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Date.now().toString().slice(-3)}`
      await api.post("/management/sales", {
        sales_number: salesNumber,
        customer_id: selectedCustomerId,
        total_sale_price: totalSalePrice,
        total_profit: totalProfit,
        is_shopee: isShopee,
        items: selectedAccounts.map((a) => ({
          account_id: a.id,
          unit_sale_price: unitPriceCalc,
          profit: unitPriceCalc - (a.capital ?? 0),
        })),
      })
      alert.success("Berhasil", "Penjualan berhasil dibuat")
      setSelectedIds([])
      setSelectedCustomerId(null)
      setSelectedCustomerName("")
      setCustomerSearchQuery("")
      setTotalSalesInput("")
      setIsShopee(false)
      setShopeeOrderNumber("")
      setPosModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ["management-accounts"] })
    } catch {
      alert.error("Gagal", "Gagal membuat penjualan")
    } finally {
      setSubmittingSale(false)
    }
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
    { value: "all", label: "All Sources" },
    ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name })),
  ]
  const phoneModelOptions = [
    { value: "all", label: "All Models" },
    ...(data?.phoneModels ?? []).map((m) => ({ value: m, label: m })),
  ]
  const targetFollowersOptions = [
    { value: "all", label: "All Targets" },
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
      <div className={`space-y-5 ${selectedIds.length > 0 ? "pb-24" : ""}`}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold">Kelola Akun</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Accounts</p>
                <p className="text-2xl font-bold mt-1">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Active accounts</p>
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
                <p className="text-xs text-muted-foreground">Combined followers</p>
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
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed Accounts</p>
                <p className="text-2xl font-bold mt-1">{completedCount}/{totalCount}</p>
                <p className="text-xs text-muted-foreground">Finished accounts</p>
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
            <p className="text-sm font-medium">Search & Filter</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari email atau username..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Dropdown options={sourceOptions} value={sourceId} onChange={(v) => { setSourceId(v); setPage(1) }} className="w-full" />
              <Dropdown options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1) }} className="w-full" />
              <Dropdown options={phoneModelOptions} value={phoneModel} onChange={(v) => { setPhoneModel(v); setPage(1) }} className="w-full" />
              <Dropdown options={targetFollowersOptions} value={targetFollowers} onChange={(v) => { setTargetFollowers(v); setPage(1) }} className="w-full" />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => { setScanSourceId("all"); setScanProgress({ status: "idle", current: 0, total: 0, sourceNames: [] }); setScanDialogOpen(true) }}
            disabled={scanProgress.status === "scanning" || syncProgress.status === "syncing"}
          >
            <RefreshCw className={`size-4 ${scanProgress.status === "scanning" ? "animate-spin" : ""}`} />
            {scanProgress.status === "scanning" ? "Scanning..." : "Scan Followers"}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => { setSyncSourceId("all"); setSyncProgress({ status: "idle", current: 0, total: 0, sourceNames: [] }); setSyncDialogOpen(true) }}
            disabled={syncProgress.status === "syncing" || scanProgress.status === "scanning"}
          >
            <Sheet className={`size-4 ${syncProgress.status === "syncing" ? "animate-spin" : ""}`} />
            {syncProgress.status === "syncing" ? "Syncing..." : "Sync Sheets"}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => navigate("/stock/accounts/history")}
          >
            <History className="size-4" />
            History
          </Button>
        </div>

        {/* Table */}
        <Card className="overflow-hidden p-0">
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
                  <TableHead>Current</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Login App</TableHead>
                  <TableHead>Capital</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRow colSpan={11} /> : !accounts.length ? (
                  <EmptyRow colSpan={11} message="No accounts found." />
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
                        <Badge variant={acc.accountStatus === "Completed" ? "completed" : "progress"}>
                          {acc.accountStatus === "Completed" ? "Completed" : "Progress"}
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
      </div>

      {/* ── POS Sidebar (fixed right) ─────────────────────────────────────── */}
      <AccountsPos
        isOpen={posModalOpen}
        onClose={() => setPosModalOpen(false)}
        selectedIds={selectedIds}
        accounts={accounts}
        customers={customers}
        customerDropdownRef={customerDropdownRef}
        selectedCustomerId={selectedCustomerId}
        selectedCustomerName={selectedCustomerName}
        customerSearchQuery={customerSearchQuery}
        showCustomerDropdown={showCustomerDropdown}
        isShopee={isShopee}
        shopeeOrderNumber={shopeeOrderNumber}
        totalSalesInput={totalSalesInput}
        unitPrice={unitPrice}
        submittingSale={submittingSale}
        onCustomerQueryChange={setCustomerSearchQuery}
        onCustomerSelect={(id, name) => { setSelectedCustomerId(id); setSelectedCustomerName(name); setCustomerSearchQuery(""); setShowCustomerDropdown(false) }}
        onDropdownFocus={() => setShowCustomerDropdown(true)}
        onClearCustomer={() => setSelectedCustomerId(null)}
        onSetIsShopee={setIsShopee}
        onSetShopeeOrderNumber={setShopeeOrderNumber}
        onSetTotalSalesInput={setTotalSalesInput}
        onSubmitSale={handleSubmitSale}
        onRemoveAccount={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
        formatCurrency={formatCurrency}
      />

      {/* ── Floating Bulk Action Bar ──────────────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 bg-background border rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground mr-1">{selectedIds.length} akun</span>
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setPosModalOpen(true)}>
            <ShoppingCart className="size-3.5" />
            Sold
          </Button>
          <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkScan}>
            <ScanLine className="size-3.5" />
            Scan
          </Button>
          <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkCopy}>
            <Copy className="size-3.5" />
            Copy
          </Button>
          <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleBulkDelete}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      )}

      {/* Scan Dialog */}
      <Dialog open={scanDialogOpen} onOpenChange={(open) => { if (scanProgress.status === "scanning") return; setScanDialogOpen(open) }}>
        <DialogContent className="max-w-md">
          {scanProgress.status === "idle" ? (
            <>
              <DialogHeader><DialogTitle>Scan Followers</DialogTitle></DialogHeader>
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">Source</p>
                <Dropdown options={[{ value: "all", label: "All Sources" }, ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name }))]} value={scanSourceId} onChange={setScanSourceId} className="w-full" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setScanDialogOpen(false)}>Cancel</Button>
                <Button onClick={runScan}>Scan</Button>
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
              {scanProgress.status === "done" && <div className="rounded bg-emerald-50 border border-emerald-200 px-4 py-3"><p className="text-sm font-medium text-emerald-700">Scan completed!</p></div>}
              {scanProgress.status === "error" && <div className="rounded bg-destructive/10 border border-destructive/20 px-4 py-3"><p className="text-sm font-medium text-destructive">{scanProgress.error}</p></div>}
              {(scanProgress.status === "done" || scanProgress.status === "error") && <div className="flex justify-end"><Button variant="outline" onClick={() => setScanDialogOpen(false)}>Close</Button></div>}
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
                <Dropdown options={[{ value: "all", label: "All Sources" }, ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name }))]} value={syncSourceId} onChange={setSyncSourceId} className="w-full" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
                <Button onClick={runSync}>Sync</Button>
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
              {syncProgress.status === "done" && <div className="rounded bg-emerald-50 border border-emerald-200 px-4 py-3"><p className="text-sm font-medium text-emerald-700">Sync completed!</p></div>}
              {syncProgress.status === "error" && <div className="rounded bg-destructive/10 border border-destructive/20 px-4 py-3"><p className="text-sm font-medium text-destructive">{syncProgress.error}</p></div>}
              {(syncProgress.status === "done" || syncProgress.status === "error") && <div className="flex justify-end"><Button variant="outline" onClick={() => setSyncDialogOpen(false)}>Close</Button></div>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
