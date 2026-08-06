import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, Clock, Search, Users, LogIn, Mail, CheckCircle2, Wallet, Banknote } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dropdown } from "@/components/ui/dropdown-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useAlert } from "@/stores/alertStore"
import { formatIDR } from "@/lib/config"
import api from "@/lib/api"

interface JobAccount {
  id: number
  employee_name: string
  email: string | null
  username: string
  year: string | null
  target_followers: number | null
  job_type: "login_only" | "email_replacement"
  login_status: "pending" | "success" | "failed"
  purchase_date: string | null
  due_date: string | null
  salary: number
  salary_paid: boolean
  salary_proof_url: string | null
  salary_paid_at: string | null
  job_source: { id: number; name: string }
}

interface JobAccountsResponse {
  accounts: JobAccount[]
  pagination: { page: number; limit: number; total: number; pages: number }
  employees: string[]
  stats: { total_accounts: number; login_only: number; email_replacement: number; selesai: number; estimasi_gaji: number; unpaid_count: number }
}

function SalaryCell({ account }: { account: JobAccount }) {
  if (account.login_status !== "success") return <span className="text-xs text-muted-foreground">-</span>
  return (
    <div>
      <p className="text-xs font-medium">{formatIDR(account.salary)}</p>
      {account.salary_paid ? (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          Sudah Digaji
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Belum Digaji
        </span>
      )}
    </div>
  )
}

const JOB_TYPE_OPTIONS = [
  { value: "all", label: "Semua Jenis" },
  { value: "login_only", label: "Login Saja" },
  { value: "email_replacement", label: "Ganti Email" },
]

const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "success", label: "Selesai" },
  { value: "pending", label: "Proses" },
  { value: "failed", label: "Error" },
]

function StatusBadge({ status }: { status: JobAccount["login_status"] }) {
  return (
    <Badge variant={status === "success" ? "completed" : status === "failed" ? "destructive" : "progress"}>
      {status === "success" ? "Selesai" : status === "failed" ? "Error" : "Proses"}
    </Badge>
  )
}

function JobTypeBadge({ type }: { type: JobAccount["job_type"] }) {
  return type === "email_replacement" ? (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Ganti Email</span>
  ) : (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Login Saja</span>
  )
}

function DueDateCell({ account }: { account: JobAccount }) {
  if (account.job_type !== "email_replacement" || !account.due_date) return <span className="text-muted-foreground">-</span>

  const due = new Date(account.due_date)
  const now = new Date()
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const isDone = account.login_status === "success"
  const label = due.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })

  if (isDone) return <span className="text-xs text-muted-foreground">{label}</span>
  if (diffDays < 0) {
    return (
      <div>
        <p className="text-xs">{label}</p>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Lewat {Math.abs(diffDays)} hari
        </span>
      </div>
    )
  }
  if (diffDays <= 7) {
    return (
      <div>
        <p className="text-xs">{label}</p>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {diffDays} hari lagi
        </span>
      </div>
    )
  }
  return <span className="text-xs text-muted-foreground">{label}</span>
}

export default function JobAccountsPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [employee, setEmployee] = useState("all")
  const [jobType, setJobType] = useState("all")
  const [status, setStatus] = useState("all")
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [paying, setPaying] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery<JobAccountsResponse>({
    queryKey: ["job-accounts", page, search, employee, jobType, status, overdueOnly],
    queryFn: () =>
      api.get("/management/job-accounts", {
        params: {
          page,
          search: search || undefined,
          employee: employee !== "all" ? employee : undefined,
          job_type: jobType !== "all" ? jobType : undefined,
          login_status: status !== "all" ? status : undefined,
          overdue: overdueOnly ? "true" : undefined,
        },
      }).then((r) => r.data),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.post("/management/job-sources/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-accounts"] })
      alert.success("Berhasil", "Sinkronisasi job selesai")
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      alert.error("Gagal", err?.response?.data?.error ?? "Gagal sinkronisasi"),
  })

  const accounts = data?.accounts ?? []
  const pagination = data?.pagination
  const employeeOptions = [{ value: "all", label: "Semua Karyawan" }, ...(data?.employees ?? []).map((e) => ({ value: e, label: e }))]
  const payableIds = accounts.filter((a) => a.login_status === "success" && !a.salary_paid).map((a) => a.id)
  const allPayableSelected = payableIds.length > 0 && payableIds.every((id) => selectedIds.includes(id))

  const toggleSelectAll = () => setSelectedIds(allPayableSelected ? [] : payableIds)
  const toggleSelect = (id: number) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]))

  const handlePayClick = () => {
    if (selectedIds.length === 0) return
    fileInputRef.current?.click()
  }

  const handleProofSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setPaying(true)
    try {
      const form = new FormData()
      form.append("proof", file)
      const uploadRes = await api.post("/management/job-accounts/upload-proof", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      await api.post("/management/job-accounts/pay", { ids: selectedIds, proof_url: uploadRes.data.url })
      queryClient.invalidateQueries({ queryKey: ["job-accounts"] })
      alert.success("Berhasil", `${selectedIds.length} akun ditandai sudah digaji`)
      setSelectedIds([])
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menandai gaji"
      alert.error("Gagal", msg)
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Job</h1>
        <p className="text-sm text-muted-foreground mt-1">Progres login &amp; ganti email akun oleh karyawan</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4">
        <StatCard title="Total Akun" value={(data?.stats.total_accounts ?? 0).toLocaleString("id-ID")} description="Semua job" icon={Users} color="blue" />
        <StatCard title="Login Saja" value={(data?.stats.login_only ?? 0).toLocaleString("id-ID")} description="Sudah ada email" icon={LogIn} color="violet" />
        <StatCard title="Ganti Email" value={(data?.stats.email_replacement ?? 0).toLocaleString("id-ID")} description="Belum ada email" icon={Mail} color="amber" />
        <StatCard title="Selesai" value={(data?.stats.selesai ?? 0).toLocaleString("id-ID")} description="Sudah beres" icon={CheckCircle2} color="emerald" />
        <StatCard title="Estimasi Gaji" value={formatIDR(data?.stats.estimasi_gaji ?? 0)} description={`${data?.stats.unpaid_count ?? 0} akun belum digaji`} icon={Wallet} color="red" />
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProofSelected} />

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <p className="text-sm">{selectedIds.length} akun dipilih</p>
          <Button size="sm" className="gap-2" onClick={handlePayClick} disabled={paying}>
            <Banknote className="size-4" />
            {paying ? "Mengunggah bukti..." : "Tandai Sudah Digaji"}
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Cari &amp; Filter</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari username / email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Karyawan</p>
              <Dropdown options={employeeOptions} value={employee} onChange={(v) => { setEmployee(v); setPage(1) }} className="w-full" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Jenis Job</p>
              <Dropdown options={JOB_TYPE_OPTIONS} value={jobType} onChange={(v) => { setJobType(v); setPage(1) }} className="w-full" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Status</p>
              <Dropdown options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1) }} className="w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons: Jatuh Tempo (kiri) - Sync (kanan), sama seperti Scan/Sync di Akun */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className={`w-full gap-2 ${overdueOnly ? "border-red-500 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30" : "border-blue-500 text-blue-600 hover:bg-blue-50"}`}
          onClick={() => { setOverdueOnly((v) => !v); setPage(1) }}
        >
          <Clock className="size-4" />
          {overdueOnly ? "Jatuh Tempo ✓" : "Jatuh Tempo"}
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`size-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Menyinkronkan..." : "Sync"}
        </Button>
      </div>

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  {payableIds.length > 0 && (
                    <Checkbox checked={allPayableSelected} onCheckedChange={toggleSelectAll} />
                  )}
                </TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gaji</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRow colSpan={8} /> : !accounts.length ? (
                <EmptyRow colSpan={8} message="Belum ada data job" />
              ) : (
                accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {a.login_status === "success" && !a.salary_paid && (
                        <Checkbox checked={selectedIds.includes(a.id)} onCheckedChange={() => toggleSelect(a.id)} />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{a.employee_name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{a.email ?? "-"}</TableCell>
                    <TableCell>@{a.username}</TableCell>
                    <TableCell><JobTypeBadge type={a.job_type} /></TableCell>
                    <TableCell><StatusBadge status={a.login_status} /></TableCell>
                    <TableCell><SalaryCell account={a} /></TableCell>
                    <TableCell><DueDateCell account={a} /></TableCell>
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
        ) : !accounts.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada data job</p>
        ) : (
          accounts.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {a.login_status === "success" && !a.salary_paid && (
                      <Checkbox className="mt-1" checked={selectedIds.includes(a.id)} onCheckedChange={() => toggleSelect(a.id)} />
                    )}
                    <div>
                      <p className="font-medium text-sm">@{a.username}</p>
                      <p className="text-xs text-muted-foreground">{a.employee_name} · {a.job_source.name}</p>
                    </div>
                  </div>
                  <StatusBadge status={a.login_status} />
                </div>
                <p className="text-xs text-muted-foreground">{a.email ?? "-"}</p>
                <div className="flex items-center justify-between pt-2 border-t">
                  <JobTypeBadge type={a.job_type} />
                  <SalaryCell account={a} />
                </div>
                <div className="flex items-center justify-end">
                  <DueDateCell account={a} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {accounts.length > 0 && (
        <Pagination page={page} total={pagination?.total ?? 0} pageSize={pagination?.limit ?? 20} onChange={setPage} />
      )}
    </div>
  )
}
