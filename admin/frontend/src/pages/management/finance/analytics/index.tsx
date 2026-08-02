import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { DollarSign, Wallet, TrendingUp, Percent } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface Comparison { change: number; label: string }
interface Summary {
  revenue: number
  profit: number
  capital: number
  margin: number
  comparisons: {
    revenue: Comparison
    profit: Comparison
    capital: Comparison
    margin: Comparison
  }
}
interface TrendPoint { date: string | number; revenue: number; profit: number }
interface CountPoint { date: string | number; count: number }
interface SourceProfit { name: string; value: number; color?: string }
interface Source { id: number; name: string }
interface AnalyticsData {
  summary: Summary
  trendData: TrendPoint[]
  salesCountTrend: CountPoint[]
  profitBySource: SourceProfit[]
  sources: Source[]
}

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
const MONTH_OPTIONS = [
  { value: "all", label: "Semua Bulan" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(2024, i, 1)),
  })),
]

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
  },
}

export default function AnalyticsPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [sourceId, setSourceId] = useState("all")

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["management-analytics", year, month, sourceId],
    queryFn: () =>
      api.get("/management/analytics", { params: { year, month, source_id: sourceId } }).then((r) => r.data),
  })

  const summary = data?.summary
  const trendData = data?.trendData ?? []
  const salesCountTrend = data?.salesCountTrend ?? []
  const profitBySource = data?.profitBySource ?? []
  const sources = data?.sources ?? []

  const totalProfitBySource = profitBySource.reduce((s, x) => s + x.value, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analitik</h1>
          <p className="text-sm text-muted-foreground mt-1">Performa bisnis berdasarkan periode</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger className="flex-1 sm:w-36 min-w-0">
              <SelectValue placeholder="Semua Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Source</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="flex-1 sm:w-36 min-w-0">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-20 sm:w-24 shrink-0">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pendapatan" icon={DollarSign} color="blue" loading={isLoading}
          value={formatIDR(summary?.revenue ?? 0)}
          comparison={summary?.comparisons.revenue}
        />
        <StatCard
          title="Modal" icon={Wallet} color="amber" loading={isLoading}
          value={formatIDR(summary?.capital ?? 0)}
          comparison={summary?.comparisons.capital}
        />
        <StatCard
          title="Profit" icon={TrendingUp} color="emerald" loading={isLoading}
          value={formatIDR(summary?.profit ?? 0)}
          valueClass="text-green-600"
          comparison={summary?.comparisons.profit}
        />
        <StatCard
          title="Margin" icon={Percent} color="violet" loading={isLoading}
          value={`${summary?.margin ?? 0}%`}
          valueClass="text-green-600"
          comparison={summary?.comparisons.margin}
        />
      </div>

      <div className="space-y-4">
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales Volume */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Volume Penjualan</CardTitle>
                <p className="text-xs text-muted-foreground">Jumlah akun terjual</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={salesCountTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v) => [v as number, "Penjualan"]}
                      labelFormatter={(l) => `Hari ${l}`}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Sales & Profit Trend */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Tren Penjualan & Profit</CardTitle>
                <p className="text-xs text-muted-foreground">Pendapatan vs Profit</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="aProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}jt`}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v, name) => [formatIDR(v as number), name === "revenue" ? "Pendapatan" : "Profit"]}
                      labelFormatter={(l) => `Hari ${l}`}
                    />
                    <Legend
                      iconType="circle" iconSize={8}
                      formatter={(value) => (value === "profit" ? "Profit" : "Pendapatan")}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#aRevenue)" dot={false} />
                    <Area type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} fill="url(#aProfit)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Profit by Source */}
          {profitBySource.length > 0 && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Profit per Source</CardTitle>
                <p className="text-xs text-muted-foreground">Distribusi profit per source</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8 flex-wrap">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie
                        data={profitBySource} dataKey="value" cx="50%" cy="50%"
                        outerRadius={90} strokeWidth={2}
                      >
                        {profitBySource.map((entry, i) => (
                          <Cell key={i} fill={entry.color ?? `hsl(${(i * 60) % 360}, 65%, 55%)`} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v) => [formatIDR(v as number), "Profit"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2.5 min-w-0">
                    {profitBySource.map((s, i) => {
                      const pct = totalProfitBySource > 0 ? ((s.value / totalProfitBySource) * 100).toFixed(1) : "0.0"
                      return (
                        <div key={i} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="inline-block size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: s.color ?? `hsl(${(i * 60) % 360}, 65%, 55%)` }}
                            />
                            <span className="text-sm text-foreground truncate">{s.name}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">{formatIDR(s.value)}</p>
                            <p className="text-xs text-muted-foreground">{pct}%</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  )
}
