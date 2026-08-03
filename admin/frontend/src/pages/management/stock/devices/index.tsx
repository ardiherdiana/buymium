import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Smartphone, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { formatIDR } from "@/lib/config"
import api from "@/lib/api"

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

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase()
  return (
    <Badge variant={s === "completed" ? "completed" : s === "error" ? "destructive" : "progress"}>
      {s === "completed" ? "Selesai" : s === "error" ? "Error" : "Proses"}
    </Badge>
  )
}

export default function DevicesPage() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data: devicesData, isLoading: devicesLoading } = useQuery<DevicesResponse>({
    queryKey: ["accounts-phone-models"],
    queryFn: () => api.get("/management/accounts/phone-models").then((r) => r.data),
  })

  const { data: accountsData, isLoading: accountsLoading } = useQuery<AccountsResponse>({
    queryKey: ["accounts-by-phone-model", selectedModel, page],
    queryFn: () =>
      api.get("/management/accounts", { params: { phone_model: selectedModel, page } }).then((r) => r.data),
    enabled: !!selectedModel,
  })

  const devices = devicesData?.devices ?? []
  const accounts = accountsData?.accounts ?? []
  const pagination = accountsData?.pagination

  if (selectedModel) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setSelectedModel(null); setPage(1) }}>
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
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Perangkat</h1>
        <p className="text-sm text-muted-foreground mt-1">Stok akun aktif per model HP</p>
      </div>

      {devicesLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
      ) : !devices.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">Belum ada data model HP</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {devices.map((d) => (
            <Card
              key={d.phone_model}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => { setSelectedModel(d.phone_model); setPage(1) }}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Smartphone className="size-5 text-blue-600" />
                </div>
                <p className="font-medium text-sm">{d.phone_model}</p>
                <p className="text-xs text-muted-foreground">{d.count.toLocaleString("id-ID")} akun</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
