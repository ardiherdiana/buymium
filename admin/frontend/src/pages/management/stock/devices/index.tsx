import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Smartphone, ArrowLeft, GripVertical, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { formatIDR } from "@/lib/config"
import api from "@/lib/api"

const ORDER_STORAGE_KEY = "devices-order-v1"

interface Device {
  phone_model: string
  count: number
}

interface DevicesResponse {
  devices: Device[]
}

interface Account {
  id: number
  email?: string
  username?: string
  password?: string
  loginApp?: string
  currentFollowers?: number
  targetFollowers?: number
  accountStatus: string
  capital?: number
  year?: string
}

interface AccountsResponse {
  accounts: Account[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

interface JobAccount {
  id: number
  employee_name: string
  email: string | null
  username: string
  password: string | null
  target_followers: number | null
  capital: number | null
  year: string | null
  aplikasi: string | null
  job_type: string
  login_status: string
  due_date: string | null
}

interface JobAccountsResponse {
  accounts: JobAccount[]
  pagination: { page: number; limit: number; total: number; pages: number }
  stats: { total_accounts: number }
}

interface DeviceJobCounts {
  devices: { hp: string; count: number }[]
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase()
  return (
    <Badge variant={s === "completed" ? "completed" : s === "error" ? "destructive" : "progress"}>
      {s === "completed" ? "Selesai" : s === "error" ? "Error" : "Proses"}
    </Badge>
  )
}

function JobStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "success" ? "completed" : status === "failed" ? "destructive" : "progress"}>
      {status === "success" ? "Selesai" : status === "failed" ? "Error" : "Proses"}
    </Badge>
  )
}

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveOrder(order: string[]) {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order))
}

export default function DevicesPage() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [jobPage, setJobPage] = useState(1)
  const [order, setOrder] = useState<string[]>(loadOrder)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const { data: devicesData, isLoading: devicesLoading } = useQuery<DevicesResponse>({
    queryKey: ["accounts-phone-models"],
    queryFn: () => api.get("/management/accounts/phone-models").then((r) => r.data),
  })

  const { data: deviceJobCountsData } = useQuery<DeviceJobCounts>({
    queryKey: ["job-accounts-hp-counts"],
    queryFn: () => api.get("/management/job-accounts/hp-counts").then((r) => r.data),
  })

  const { data: accountsData, isLoading: accountsLoading } = useQuery<AccountsResponse>({
    queryKey: ["accounts-by-phone-model", selectedModel, page],
    queryFn: () =>
      api.get("/management/accounts", { params: { phone_model: selectedModel, page } }).then((r) => r.data),
    enabled: !!selectedModel,
  })

  const { data: jobAccountsData, isLoading: jobAccountsLoading } = useQuery<JobAccountsResponse>({
    queryKey: ["job-accounts-by-hp", selectedModel, jobPage],
    queryFn: () =>
      api.get("/management/job-accounts", { params: { hp: selectedModel, login_status: "not_success", page: jobPage } }).then((r) => r.data),
    enabled: !!selectedModel,
  })

  const devices = devicesData?.devices ?? []
  const accounts = accountsData?.accounts ?? []
  const pagination = accountsData?.pagination
  const jobAccounts = jobAccountsData?.accounts ?? []
  const jobPagination = jobAccountsData?.pagination
  const jobCountByDevice = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of deviceJobCountsData?.devices ?? []) map.set(d.hp, d.count)
    return map
  }, [deviceJobCountsData])

  const sortedDevices = useMemo(() => {
    if (!order.length) return devices
    const rank = new Map(order.map((m, i) => [m, i]))
    return [...devices].sort((a, b) => {
      const ra = rank.has(a.phone_model) ? rank.get(a.phone_model)! : Infinity
      const rb = rank.has(b.phone_model) ? rank.get(b.phone_model)! : Infinity
      return ra - rb
    })
  }, [devices, order])

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return
    const next = [...sortedDevices.map((d) => d.phone_model)]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, moved)
    setOrder(next)
    saveOrder(next)
    setDragIndex(null)
  }

  if (selectedModel) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setSelectedModel(null); setPage(1); setJobPage(1) }}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{selectedModel}</h1>
            <p className="text-sm text-muted-foreground mt-1">Akun aktif yang tersimpan di device ini</p>
          </div>
        </div>

        {/* Desktop: table */}
        <Card className="overflow-hidden p-0 hidden sm:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Saat Ini</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modal</TableHead>
                  <TableHead>Tahun</TableHead>
                  <TableHead>Aplikasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountsLoading ? <LoadingRow colSpan={9} /> : !accounts.length ? (
                  <EmptyRow colSpan={9} message="Tidak ada akun di device ini" />
                ) : (
                  accounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="text-xs text-muted-foreground">{acc.email ?? "-"}</TableCell>
                      <TableCell className="font-medium text-sm">{acc.username ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.password ?? "-"}</TableCell>
                      <TableCell>{acc.currentFollowers?.toLocaleString("id-ID") ?? "-"}</TableCell>
                      <TableCell>{acc.targetFollowers?.toLocaleString("id-ID") ?? "-"}</TableCell>
                      <TableCell><StatusBadge status={acc.accountStatus} /></TableCell>
                      <TableCell>{acc.capital ? formatIDR(acc.capital) : "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.year ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{acc.loginApp ?? "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Mobile: cards */}
        <div className="flex flex-col gap-3 sm:hidden">
          {accountsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
          ) : !accounts.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada akun di device ini</p>
          ) : (
            accounts.map((acc) => (
              <Card key={acc.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{acc.username ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{acc.email ?? "-"}</p>
                    </div>
                    <StatusBadge status={acc.accountStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground">Aplikasi: {acc.loginApp ?? "-"} · Tahun: {acc.year ?? "-"}</p>
                  <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                    <span>{acc.currentFollowers?.toLocaleString("id-ID") ?? "-"} / {acc.targetFollowers?.toLocaleString("id-ID") ?? "-"}</span>
                    <span>{acc.capital ? formatIDR(acc.capital) : "-"}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {accounts.length > 0 && (
          <Pagination page={page} total={pagination?.total ?? 0} pageSize={pagination?.limit ?? 100} onChange={setPage} />
        )}

        {/* Job belum selesai di HP ini */}
        {(jobAccountsLoading || jobAccounts.length > 0) && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-amber-600" />
              <h2 className="text-sm font-semibold">Job Belum Selesai di HP Ini</h2>
            </div>

            <Card className="overflow-hidden p-0 hidden sm:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Saat Ini</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Modal</TableHead>
                      <TableHead>Tahun</TableHead>
                      <TableHead>Aplikasi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobAccountsLoading ? <LoadingRow colSpan={9} /> : !jobAccounts.length ? (
                      <EmptyRow colSpan={9} message="Tidak ada job yang belum selesai di HP ini" />
                    ) : (
                      jobAccounts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs text-muted-foreground">{a.email ?? "-"}</TableCell>
                          <TableCell className="font-medium text-sm">{a.username}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.password ?? "-"}</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>{a.target_followers?.toLocaleString("id-ID") ?? "-"}</TableCell>
                          <TableCell><JobStatusBadge status={a.login_status} /></TableCell>
                          <TableCell>{a.capital ? formatIDR(a.capital) : "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.year ?? "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.aplikasi ?? "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:hidden">
              {jobAccountsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
              ) : (
                jobAccounts.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{a.username}</p>
                          <p className="text-xs text-muted-foreground">{a.email ?? "-"}</p>
                        </div>
                        <JobStatusBadge status={a.login_status} />
                      </div>
                      <p className="text-xs text-muted-foreground">Aplikasi: {a.aplikasi ?? "-"} · Tahun: {a.year ?? "-"}</p>
                      <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                        <span>- / {a.target_followers?.toLocaleString("id-ID") ?? "-"}</span>
                        <span>{a.capital ? formatIDR(a.capital) : "-"}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {jobAccounts.length > 0 && (
              <Pagination page={jobPage} total={jobPagination?.total ?? 0} pageSize={jobPagination?.limit ?? 20} onChange={setJobPage} />
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Perangkat</h1>
        <p className="text-sm text-muted-foreground mt-1">Stok akun aktif per model HP — geser kartu untuk mengubah urutan</p>
      </div>

      {devicesLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedDevices.map((d, i) => {
            const jobCount = jobCountByDevice.get(d.phone_model) ?? 0
            return (
              <Card
                key={d.phone_model}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => setDragIndex(null)}
                className={`cursor-pointer hover:border-primary transition-colors relative ${dragIndex === i ? "opacity-50" : ""}`}
                onClick={() => { setSelectedModel(d.phone_model); setPage(1); setJobPage(1) }}
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <GripVertical className="size-3.5 text-muted-foreground absolute top-2 right-2 cursor-grab" />
                  {jobCount > 0 && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <Briefcase className="size-2.5" />
                      {jobCount}
                    </span>
                  )}
                  <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Smartphone className="size-5 text-blue-600" />
                  </div>
                  <p className="font-medium text-sm">{d.phone_model}</p>
                  <p className="text-xs text-muted-foreground">{d.count.toLocaleString("id-ID")} akun</p>
                </CardContent>
              </Card>
            )
          })}

          {!devices.length && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-8">Belum ada data model HP</p>
          )}
        </div>
      )}
    </div>
  )
}
