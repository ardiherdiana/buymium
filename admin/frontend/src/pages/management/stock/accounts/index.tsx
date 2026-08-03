import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, RefreshCw, Sheet, Users, CheckCircle2, Trash2, Wallet } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dropdown } from "@/components/ui/dropdown-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { Checkbox } from "@/components/ui/checkbox"
import { useAlert } from "@/stores/alertStore"
import { useNavigate } from "react-router"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"
import { useStockListing, type StockEntityConfig } from "@/hooks/use-stock-listing"
import { SyncScanDialogs } from "@/components/stock/sync-scan-dialogs"
import { BulkActionBar } from "@/components/stock/bulk-action-bar"

interface Account {
  id: number
  username?: string
  email?: string
  passwordEmail?: string
  password?: string
  twoFactorAuth?: string
  currentFollowers?: number
  targetFollowers?: number
  accountStatus: string
  loginApp?: string
  capital?: number
  phoneModel?: string
  year?: string
  sourceSheetName?: string
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
  years: string[]
  targetFollowers: number[]
  pagination: { page: number; limit: number; total: number; pages: number }
  stats: {
    total_accounts: number
    total_followers: number
    target_followers: number
    completed_accounts: number
    total_capital: number
  }
}

const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "Completed", label: "Selesai" },
  { value: "Progress", label: "Proses" },
  { value: "Error", label: "Error" },
]

const PAGE_SIZE = 100

const ENTITY_CONFIG: StockEntityConfig<Account> = {
  queryKey: "management-accounts",
  basePath: "/management/accounts",
  syncPath: "/management/accounts/sync",
  scanListPath: "/management/accounts/scan/list",
  scanListItemsKey: "accounts",
  buildSyncBody: (sourceId) => ({ source_id: sourceId !== "all" ? sourceId : undefined }),
  getItems: (data) => data ?? [],
  labels: { scanDone: "akun berhasil di-scan" },
}

export default function AccountsPage() {
  const alert = useAlert()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [sourceId, setSourceId] = useState("all")
  const [year, setYear] = useState("all")
  const [targetFollowers, setTargetFollowers] = useState("all")

  const { data, isLoading } = useQuery<AccountsResponse>({
    queryKey: ["management-accounts", page, search, status, sourceId, year, targetFollowers],
    queryFn: () =>
      api.get("/management/accounts", {
        params: {
          page,
          search: search || undefined,
          status: status !== "all" ? status : undefined,
          source_id: sourceId !== "all" ? sourceId : undefined,
          year: year !== "all" ? year : undefined,
          target_followers: targetFollowers !== "all" ? targetFollowers : undefined,
        },
      }).then((r) => r.data),
  })

  const accounts = data?.accounts ?? []
  const stats = data?.stats

  const listing = useStockListing<Account>(ENTITY_CONFIG, accounts)

  // ── Copy credentials ───────────────────────────────────────────────────────
  const handleBulkCopy = () => {
    const accs = accounts.filter((a) => listing.selectedIds.includes(a.id))
    if (!accs.length) return
    const lines = accs.map((acc, i) => {
      const parts: string[] = []
      if (acc.email) parts.push(`Email: ${acc.email}`)
      if (acc.passwordEmail) parts.push(`Password Email: ${acc.passwordEmail}`)
      if (acc.username) parts.push(`Username: ${acc.username}`)
      if (acc.password) parts.push(`Password: ${acc.password}`)
      if (acc.twoFactorAuth) parts.push(`2FA: ${acc.twoFactorAuth}`)
      return `${i + 1}. ${parts.join("\n   ")}`
    })
    navigator.clipboard.writeText(lines.join("\n\n"))
    alert.success("Disalin", `${accs.length} akun disalin ke clipboard`)
  }

  const sourceOptions = [
    { value: "all", label: "Semua Source" },
    ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name })),
  ]
  const yearOptions = [
    { value: "all", label: "Semua Tahun" },
    ...(data?.years ?? []).map((y) => ({ value: y, label: y })),
  ]
  const targetFollowersOptions = [
    { value: "all", label: "Semua Target" },
    ...(data?.targetFollowers ?? []).map((f) => ({ value: String(f), label: f.toLocaleString("id-ID") })),
  ]

  const completedCount = stats?.completed_accounts ?? 0
  const totalCount = stats?.total_accounts ?? 0

  return (
    <div>
      <div className={`space-y-5 ${listing.selectedIds.length > 0 ? "pb-20 sm:pb-24" : ""}`}>
        <div>
          <h1 className="text-xl font-semibold">Kelola Akun</h1>
          <p className="text-sm text-muted-foreground mt-1">Stok akun hasil sync Google Sheets</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          <StatCard title="Total Akun" value={totalCount.toLocaleString("id-ID")} description="Akun aktif" icon={Users} color="blue" />
          <StatCard title="Akun Selesai" value={completedCount.toLocaleString("id-ID")} description="Akun selesai" icon={CheckCircle2} color="emerald" />
          <StatCard title="Total Modal" value={formatIDR(stats?.total_capital ?? 0)} description="Total modal akun" icon={Wallet} color="amber" />
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
                <p className="text-xs text-muted-foreground font-medium">Tahun</p>
                <Dropdown options={yearOptions} value={year} onChange={(v) => { setYear(v); setPage(1) }} className="w-full" />
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
            onClick={listing.openScanDialog}
            disabled={listing.scanProgress.status === "scanning" || listing.syncProgress.status === "syncing"}
          >
            <RefreshCw className={`size-4 ${listing.scanProgress.status === "scanning" ? "animate-spin" : ""}`} />
            {listing.scanProgress.status === "scanning" ? "Memindai..." : "Scan Followers"}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={listing.openSyncDialog}
            disabled={listing.syncProgress.status === "syncing" || listing.scanProgress.status === "scanning"}
          >
            <Sheet className={`size-4 ${listing.syncProgress.status === "syncing" ? "animate-spin" : ""}`} />
            {listing.syncProgress.status === "syncing" ? "Menyinkronkan..." : "Sync Sheets"}
          </Button>
        </div>

        {/* Desktop: table */}
        <Card className="overflow-hidden p-0 hidden sm:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={listing.allSelected} onCheckedChange={listing.toggleAll} />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Saat Ini</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modal</TableHead>
                  <TableHead>Tahun</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRow colSpan={10} /> : !accounts.length ? (
                  <EmptyRow colSpan={10} message="Tidak ada akun ditemukan." />
                ) : (
                  accounts.map((acc) => (
                    <TableRow key={acc.id} className={listing.selectedIds.includes(acc.id) ? "bg-muted/40" : ""}>
                      <TableCell>
                        <Checkbox checked={listing.selectedIds.includes(acc.id)} onCheckedChange={() => listing.toggleOne(acc.id)} />
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
                      <TableCell>{acc.capital ? formatIDR(acc.capital) : "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.year ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="size-8 text-blue-600 hover:text-blue-700"
                            onClick={() => listing.refreshMutation.mutate(acc.id)}
                            disabled={listing.refreshMutation.isPending}
                          >
                            <RefreshCw className="size-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                            onClick={() => listing.handleDelete(acc.id, acc.username ?? acc.email ?? "")}
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
              <Card key={acc.id} className={listing.selectedIds.includes(acc.id) ? "ring-2 ring-primary" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox checked={listing.selectedIds.includes(acc.id)} onCheckedChange={() => listing.toggleOne(acc.id)} className="shrink-0" />
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
                      <span className="text-muted-foreground">Tahun</span>
                      <span className="font-medium truncate">{acc.year ?? "-"}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end pt-2 border-t">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost" size="icon" className="size-8 text-blue-600 hover:text-blue-700"
                        onClick={() => listing.refreshMutation.mutate(acc.id)}
                        disabled={listing.refreshMutation.isPending}
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                        onClick={() => listing.handleDelete(acc.id, acc.username ?? acc.email ?? "")}
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

      <BulkActionBar
        count={listing.selectedIds.length}
        onSell={() => navigate("/stock/accounts/pos", { state: { selectedIds: listing.selectedIds } })}
        onScan={listing.handleBulkScan}
        onCopy={handleBulkCopy}
        onDelete={listing.handleBulkDelete}
      />

      <SyncScanDialogs
        sourceOptions={sourceOptions}
        syncDialogOpen={listing.syncDialogOpen}
        onSyncOpenChange={listing.setSyncDialogOpen}
        syncSourceId={listing.syncSourceId}
        onSyncSourceIdChange={listing.setSyncSourceId}
        syncProgress={listing.syncProgress}
        onRunSync={() => listing.runSync(data?.sources ?? [])}
        scanDialogOpen={listing.scanDialogOpen}
        onScanOpenChange={listing.setScanDialogOpen}
        scanSourceId={listing.scanSourceId}
        onScanSourceIdChange={listing.setScanSourceId}
        scanProgress={listing.scanProgress}
        onRunScan={listing.runScan}
      />
    </div>
  )
}
