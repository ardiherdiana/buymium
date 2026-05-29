import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Search, History, RefreshCw, Sheet, Users, ArrowLeft, Heart, CheckCircle2, Trash2 } from "lucide-react"
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

interface Source {
  id: number
  name: string
}

interface AccsmarketsResponse {
  accsmarkets: Accsmarket[]
  sources: Source[]
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

export default function AccsmarketPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [sourceId, setSourceId] = useState("all")
  const [followers, setFollowers] = useState("all")
  const [year, setYear] = useState("all")
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const { data, isLoading } = useQuery<AccsmarketsResponse>({
    queryKey: ["management-accsmarkets", page, search, status, sourceId, followers, year],
    queryFn: () =>
      api.get("/management/accsmarkets/index", {
        params: {
          page,
          search: search || undefined,
          status: status !== "all" ? status : undefined,
          source_id: sourceId !== "all" ? sourceId : undefined,
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
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["management-accsmarkets"] })
      alert.success("Berhasil", `Followers akun #${id} berhasil diperbarui`)
    },
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

  const handleDelete = async (acc: Accsmarket) => {
    const ok = await alert.confirm("Hapus Akun", `Hapus akun "${acc.username ?? acc.email}"?`)
    if (ok) deleteMutation.mutate(acc.id)
  }

  const accsmarkets = data?.accsmarkets ?? []
  const stats = data?.stats

  const sourceOptions = [
    { value: "all", label: "All Sources" },
    ...(data?.sources ?? []).map((s) => ({ value: String(s.id), label: s.name })),
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

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : allIds)
  }

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <div className="space-y-5">
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
            <Dropdown options={sourceOptions} value={sourceId} onChange={(v) => { setSourceId(v); setPage(1) }} className="w-full" />
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
          <Sheet className="size-4" />
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
                  <TableRow key={acc.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(acc.id)}
                        onCheckedChange={() => toggleOne(acc.id)}
                      />
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
                          variant="ghost"
                          size="icon"
                          className="size-8 text-blue-600 hover:text-blue-700"
                          onClick={() => refreshMutation.mutate(acc.id)}
                          disabled={refreshMutation.isPending}
                        >
                          <RefreshCw className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
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
  )
}
