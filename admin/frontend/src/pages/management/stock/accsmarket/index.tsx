import { useState, useEffect, useRef, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Search, History, RefreshCw, Sheet, Users, ArrowLeft, Heart, CheckCircle2, Trash2, Copy, ScanLine, ShoppingCart } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dropdown } from "@/components/ui/dropdown-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useAlert } from "@/stores/alertStore"
import { useNavigate } from "react-router"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"
import AccsmarketPos from "./pos"

interface Accsmarket {
  id: number
  username?: string
  email?: string
  password?: string
  passwordEmail?: string
  twoFactorAuth?: string
  accountStatus: string
  targetFollowers?: number
  currentFollowers?: number
  year?: string
  capital?: number
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

interface AccsmarketsResponse {
  accsmarkets: Accsmarket[]
  sources: Source[]
  sheets: string[]
  targetFollowers: number[]
  years: string[]
  stats: {
    total_accounts: number
    total_followers: number
    completed_accounts: number
  }
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "completed", label: "Completed" },
  { value: "progress", label: "Progress" },
]

const PAGE_SIZE = 100

const formatCurrency = (n: number | null) => {
  if (n === null || n === undefined) return "-"
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
}

export default function AccsmarketPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [sheets, setSheets] = useState("all")
  const [followers, setFollowers] = useState("all")
  const [year, setYear] = useState("all")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [posModalOpen, setPosModalOpen] = useState(false)

  // POS state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState("")
  const [customerSearchQuery, setCustomerSearchQuery] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [isShopee, setIsShopee] = useState(false)
  const [totalSalesInput, setTotalSalesInput] = useState("")
  const [submittingSale, setSubmittingSale] = useState(false)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery<AccsmarketsResponse>({
    queryKey: ["management-accsmarkets", page, search, status, sheets, followers, year],
    queryFn: () =>
      api.get("/management/accsmarkets/index", {
        params: {
          page,
          search: search || undefined,
          status: status !== "all" ? status : undefined,
          sheets: sheets !== "all" ? sheets : undefined,
          followers: followers !== "all" ? followers : undefined,
          year: year !== "all" ? year : undefined,
        },
      }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/management/accsmarkets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-accsmarkets"] })
      alert.success("Berhasil", "Akun berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus akun"),
  })

  const refreshMutation = useMutation({
    mutationFn: (id: number) => api.post(`/management/accsmarkets/${id}/refresh-followers`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["management-accsmarkets"] }),
    onError: () => alert.error("Gagal", "Gagal memperbarui followers"),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.post("/management/accsmarkets/sync", { sourceId: sourceId !== "all" ? parseInt(sourceId) : data?.sources?.[0]?.id }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["management-accsmarkets"] })
      alert.success("Berhasil", res.data.message)
    },
    onError: () => alert.error("Gagal", "Gagal sync sheets"),
  })

  // Load customers
  useEffect(() => {
    api.get("/management/accsmarkets/search/customers").then((r) => {
      setCustomers(r.data?.customers ?? [])
    }).catch(() => {})
  }, [])

  // Customer search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      if (customerSearchQuery) {
        api.get("/management/accsmarkets/search/customers", { params: { search: customerSearchQuery } }).then((r) => {
          setCustomers(r.data?.customers ?? [])
        }).catch(() => {})
      }
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearchQuery])

  // Click outside dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node))
        setShowCustomerDropdown(false)
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
    const toScan = (data?.accsmarkets ?? []).filter((a) => selectedIds.includes(a.id))
    if (!toScan.length) return
    for (const acc of toScan) {
      try { await api.post(`/management/accsmarkets/${acc.id}/refresh-followers`) } catch { /* continue */ }
    }
    queryClient.invalidateQueries({ queryKey: ["management-accsmarkets"] })
    alert.success("Selesai", `${toScan.length} akun berhasil di-scan`)
  }

  // ── Copy credentials ───────────────────────────────────────────────────────
  const handleBulkCopy = () => {
    const accs = (data?.accsmarkets ?? []).filter((a) => selectedIds.includes(a.id))
    if (!accs.length) return
    const lines = accs.map((acc, i) => {
      const parts: string[] = []
      if (acc.email) parts.push(`Email: ${acc.email}`)
      if (acc.username) parts.push(`Username: ${acc.username}`)
      if (acc.password) parts.push(`Password: ${acc.password}`)
      if (acc.twoFactorAuth) parts.push(`2FA: ${acc.twoFactorAuth}`)
      return `${i + 1}. ${parts.join("\n   ")}`
    })
    navigator.clipboard.writeText(lines.join("\n\n"))
    alert.success("Disalin", `${accs.length} akun disalin ke clipboard`)
  }

  // ── Delete selected ────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    const ok = await alert.confirm("Hapus Akun", `Hapus ${selectedIds.length} akun yang dipilih?`)
    if (!ok) return
    await Promise.all(selectedIds.map((id) => api.delete(`/management/accsmarkets/${id}`).catch(() => {})))
    queryClient.invalidateQueries({ queryKey: ["management-accsmarkets"] })
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
      const selected = (data?.accsmarkets ?? []).filter((a) => selectedIds.includes(a.id))
      const totalSalePrice = parseInt(totalSalesInput.replace(/\D/g, "") || "0")
      const unitPriceCalc = totalSalePrice / selected.length
      const totalProfit = selected.reduce((s, a) => s + (unitPriceCalc - (a.capital ?? 0)), 0)
      const salesNumber = `SAL-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Date.now().toString().slice(-3)}`
      await api.post("/management/sales", {
        sales_number: salesNumber,
        customer_id: selectedCustomerId,
        total_sale_price: totalSalePrice,
        total_profit: totalProfit,
        is_shopee: isShopee,
        items: selected.map((a) => ({
          accsmarket_id: a.id,
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
      setPosModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ["management-accsmarkets"] })
    } catch {
      alert.error("Gagal", "Gagal membuat penjualan")
    } finally {
      setSubmittingSale(false)
    }
  }

  const handleDelete = async (acc: Accsmarket) => {
    const ok = await alert.confirm("Hapus Akun", `Hapus akun "${acc.username ?? acc.email}"?`)
    if (ok) deleteMutation.mutate(acc.id)
  }

  const accsmarkets = data?.accsmarkets ?? []
  const stats = data?.stats

  const sheetsOptions = [
    { value: "all", label: "All Sheets" },
    ...(data?.sheets ?? []).map((s) => ({ value: s, label: s })),
  ]
  const followersOptions = [
    { value: "all", label: "All Targets" },
    ...(data?.targetFollowers ?? []).map((f) => ({ value: String(f), label: f.toLocaleString("id-ID") })),
  ]
  const yearOptions = [
    { value: "all", label: "All Years" },
    ...(data?.years ?? []).map((y) => ({ value: y, label: y })),
  ]

  const allIds = accsmarkets.map((a) => a.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))
  const toggleAll = () => setSelectedIds(allSelected ? [] : allIds)
  const toggleOne = (id: number) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  return (
    <div>
      <div className={`space-y-5 ${selectedIds.length > 0 ? "pb-24" : ""}`}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold">AccsMarket</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Accounts</p>
                <p className="text-2xl font-bold mt-1">{stats?.total_accounts ?? 0}</p>
                <p className="text-xs text-muted-foreground">All accounts</p>
              </div>
              <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="size-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Accounts</p>
                <p className="text-2xl font-bold mt-1">{stats?.completed_accounts ?? 0}</p>
                <p className="text-xs text-muted-foreground">Completed accounts</p>
              </div>
              <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Followers</p>
                <p className="text-2xl font-bold mt-1">{stats?.total_followers?.toLocaleString("id-ID") ?? 0}</p>
                <p className="text-xs text-muted-foreground">Combined followers</p>
              </div>
              <div className="size-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Heart className="size-5 text-red-500" />
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
              <Dropdown options={sheetsOptions} value={sheets} onChange={(v) => { setSheets(v); setPage(1) }} className="w-full" />
              <Dropdown options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1) }} className="w-full" />
              <Dropdown options={followersOptions} value={followers} onChange={(v) => { setFollowers(v); setPage(1) }} className="w-full" />
              <Dropdown options={yearOptions} value={year} onChange={(v) => { setYear(v); setPage(1) }} className="w-full" />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50">
            <RefreshCw className="size-4" />
            Scan Followers
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <Sheet className={`size-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Syncing..." : "Sync Sheets"}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => navigate("/stock/accsmarket/history")}
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
                  <TableHead>2FA</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Capital</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRow colSpan={11} /> : !accsmarkets.length ? (
                  <EmptyRow colSpan={11} message="No accsmarkets found." />
                ) : (
                  accsmarkets.map((acc) => (
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
                        <Badge variant={acc.accountStatus === "completed" ? "completed" : "progress"}>
                          {acc.accountStatus === "completed" ? "Completed" : "Progress"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.twoFactorAuth ?? "-"}</TableCell>
                      <TableCell className="text-xs">{acc.year ?? "-"}</TableCell>
                      <TableCell>{acc.capital ? formatIDR(acc.capital) : "-"}</TableCell>
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
            <Pagination page={page} total={accsmarkets.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </CardContent>
        </Card>
      </div>

      {/* POS Popup */}
      <AccsmarketPos
        isOpen={posModalOpen}
        onClose={() => setPosModalOpen(false)}
        selectedIds={selectedIds}
        accsmarkets={accsmarkets}
        customers={customers}
        customerDropdownRef={customerDropdownRef}
        selectedCustomerId={selectedCustomerId}
        selectedCustomerName={selectedCustomerName}
        customerSearchQuery={customerSearchQuery}
        showCustomerDropdown={showCustomerDropdown}
        isShopee={isShopee}
        totalSalesInput={totalSalesInput}
        unitPrice={unitPrice}
        submittingSale={submittingSale}
        onCustomerQueryChange={setCustomerSearchQuery}
        onCustomerSelect={(id, name) => { setSelectedCustomerId(id); setSelectedCustomerName(name); setCustomerSearchQuery(""); setShowCustomerDropdown(false) }}
        onDropdownFocus={() => setShowCustomerDropdown(true)}
        onClearCustomer={() => setSelectedCustomerId(null)}
        onSetIsShopee={setIsShopee}
        onSetTotalSalesInput={setTotalSalesInput}
        onSubmitSale={handleSubmitSale}
        onRemoveAccount={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
        formatCurrency={formatCurrency}
      />

      {/* Floating Bulk Action Bar */}
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
    </div>
  )
}
