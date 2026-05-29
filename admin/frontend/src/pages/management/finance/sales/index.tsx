import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Eye, Trash2, ShoppingCart, Wallet, TrendingUp, BarChart2 } from "lucide-react"
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"
import { useAlert } from "@/stores/alertStore"

interface Source { id: number; name: string; color: string }
interface Sale {
  id: number
  salesNumber: string
  customer: { usernameSh: string }
  source: Source
  totalSalePrice: number
  totalProfit: number
  createdAt: string
}
interface ChartPoint { label: string; sales: number; amount: number; profit: number }
interface Stats { totalSales: number; totalCapital: number; totalSalePrice: number; totalProfit: number }
interface SalesResponse {
  sales: Sale[]
  pagination: { page: number; limit: number; total: number; pages: number }
  stats: Stats
  chartData: ChartPoint[]
}

function StatCard({ title, value, icon: Icon, valueClass, loading }: {
  title: string; value: string; icon: React.ElementType; valueClass?: string; loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-7 w-36" /> : (
          <p className={`text-2xl font-bold ${valueClass ?? "text-foreground"}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  )
}

const MONTH_LABEL = new Date().toLocaleString("id-ID", { month: "long", year: "numeric" })

export default function SalesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const alert = useAlert()

  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState("")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<SalesResponse>({
    queryKey: ["management-sales", page, search, sourceFilter],
    queryFn: () =>
      api.get("/management/sales", { params: { page, search: search || undefined, source: sourceFilter || undefined } }).then((r) => r.data),
  })

  const { data: sourcesData } = useQuery<{ sources: Source[] }>({
    queryKey: ["management-sources"],
    queryFn: () => api.get("/management/sources").then((r) => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/management/sales/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-sales"] })
      alert.success("Berhasil", "Penjualan berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus penjualan"),
  })

  const handleDelete = async (sale: Sale) => {
    const ok = await alert.confirm("Hapus Penjualan", `Hapus penjualan ${sale.salesNumber}?`)
    if (ok) deleteMut.mutate(sale.id)
  }

  const stats = data?.stats
  const chartData = data?.chartData ?? []
  const sales = data?.sales ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Penjualan</h1>
        <p className="text-sm text-muted-foreground mt-1">Data penjualan management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Penjualan" value={(stats?.totalSales ?? 0).toLocaleString("id-ID")} icon={ShoppingCart} loading={isLoading} />
        <StatCard title="Total Modal" value={formatIDR(stats?.totalCapital ?? 0)} icon={Wallet} loading={isLoading} />
        <StatCard title="Total Harga Jual" value={formatIDR(stats?.totalSalePrice ?? 0)} icon={BarChart2} loading={isLoading} />
        <StatCard title="Total Profit" value={formatIDR(stats?.totalProfit ?? 0)} icon={TrendingUp} valueClass="text-green-600" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sales — {MONTH_LABEL}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
                  formatter={(v) => [v as number, "Penjualan"]}
                  labelFormatter={(l) => `Hari ke-${l}`}
                />
                <Bar dataKey="sales" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Profit & Revenue — {MONTH_LABEL}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
                  formatter={(v, name) => [formatIDR(v as number), name === "amount" ? "Revenue" : "Profit"]}
                  labelFormatter={(l) => `Hari ke-${l}`}
                />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenue)" dot={false} />
                <Area type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} fill="url(#colorProfit)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Cari sales number / pelanggan..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-64"
        />
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v === "__all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Semua Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Semua Source</SelectItem>
            {sourcesData?.sources.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">NO</TableHead>
                <TableHead>Sales Number</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <LoadingRow colSpan={8} />
              ) : sales.length === 0 ? (
                <EmptyRow colSpan={8} message="Tidak ada data penjualan" />
              ) : sales.map((sale, idx) => (
                <TableRow key={sale.id}>
                  <TableCell className="text-muted-foreground">
                    {((pagination?.page ?? 1) - 1) * (pagination?.limit ?? 20) + idx + 1}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{sale.salesNumber}</TableCell>
                  <TableCell>{sale.customer?.usernameSh ?? "-"}</TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: sale.source?.color ?? "#6b7280" }}
                    >
                      {sale.source?.name ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(sale.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-right">{formatIDR(sale.totalSalePrice)}</TableCell>
                  <TableCell className="text-right font-medium text-green-600">{formatIDR(sale.totalProfit)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate(`/finance/sales/${sale.id}`)}>
                        <Eye className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => handleDelete(sale)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} total={pagination?.total ?? 0} pageSize={pagination?.limit ?? 20} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  )
}
