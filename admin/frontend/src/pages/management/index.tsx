import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  DollarSign, TrendingUp, Users, Package, Activity, UserSquare,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard, type StatCardColor } from "@/components/ui/stat-card"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface Source {
  id: number
  name: string
}

interface DashboardResponse {
  statistics: {
    total_users: number
    total_accounts: number
    active_accounts: number
    total_customers: number
    total_revenue: number
    total_profit: number
  }
  accounts_stock: {
    total_stock: number
    platforms: Platform[]
    distribution: DistItem[]
  }
  accsmarket_stock: {
    total_stock: number
    platforms: AccsmarketPlatform[]
    distribution: DistItem[]
  }
  sources: Source[]
}

interface Platform {
  id: number | string | null | undefined
  name: string
  image: string | null
  total_stock: number
  distribution: { range: string; count: number }[]
}

interface AccsmarketPlatform {
  id: string
  name: string
  subtitle: string
  image: string | null
  total_stock: number
  distribution: { range: string; count: number }[]
}

interface DistItem {
  name: string
  value: number
  percentage: number
  source_id: number | null | undefined
  color?: string | null
}

function PlatformCard({ name, image, total_stock, distribution }: Platform) {
  const apiBase = import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:5001"
  const imgSrc = image
    ? (image.startsWith("http") ? image : `${apiBase}${image}`)
    : null

  return (
    <div className="border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        {imgSrc ? (
          <img src={imgSrc} alt={name} className="size-8 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
        ) : (
          <div className="size-8 bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <p className="text-sm font-semibold text-foreground truncate min-w-0">{name}</p>
        <span className="ml-auto text-xl font-bold text-foreground shrink-0">{total_stock.toLocaleString("id-ID")}</span>
      </div>

      {distribution.length > 0 && (
        <div className="space-y-1.5">
          {distribution.map((d) => (
            <div key={d.range} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate max-w-[70%]">{d.range}</span>
              <span className="font-medium text-foreground">{d.count.toLocaleString("id-ID")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AccsmarketCard({ name, subtitle, image, total_stock, distribution }: AccsmarketPlatform) {
  const apiBase = import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:5001"
  const imgSrc = image
    ? (image.startsWith("http") ? image : `${apiBase}${image}`)
    : null

  return (
    <div className="border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        {imgSrc ? (
          <img src={imgSrc} alt={name} className="size-8 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
        ) : (
          <div className="size-8 bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="ml-auto text-xl font-bold text-foreground shrink-0">{total_stock.toLocaleString("id-ID")}</span>
      </div>

      {distribution.length > 0 && (
        <div className="space-y-1.5">
          {distribution.map((d) => (
            <div key={d.range} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate max-w-[70%]">{d.range}</span>
              <span className="font-medium text-foreground">{d.count.toLocaleString("id-ID")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ManagementDashboard() {
  const [activeSourceId, setActiveSourceId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<DashboardResponse>({
    queryKey: ["management-dashboard"],
    queryFn: () => api.get("/management/dashboard").then((r) => r.data),
  })

  const stats = data?.statistics
  const accountsStock = data?.accounts_stock
  const accsmarketStock = data?.accsmarket_stock
  const sources = data?.sources ?? []

  // Default to the first source once the list loads
  useEffect(() => {
    if (activeSourceId === null && sources.length > 0) {
      setActiveSourceId(sources[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length])

  const statCards: { title: string; value: string; icon: React.ElementType; color: StatCardColor }[] = [
    { title: "Total Pendapatan", value: formatIDR(stats?.total_revenue ?? 0), icon: DollarSign, color: "emerald" },
    { title: "Total Profit", value: formatIDR(stats?.total_profit ?? 0), icon: TrendingUp, color: "emerald" },
    { title: "Total Pengguna", value: (stats?.total_users ?? 0).toLocaleString("id-ID"), icon: Users, color: "blue" },
    { title: "Total Akun", value: (stats?.total_accounts ?? 0).toLocaleString("id-ID"), icon: Package, color: "blue" },
    { title: "Akun Aktif", value: (stats?.active_accounts ?? 0).toLocaleString("id-ID"), icon: Activity, color: "violet" },
    { title: "Total Pelanggan", value: (stats?.total_customers ?? 0).toLocaleString("id-ID"), icon: UserSquare, color: "amber" },
  ]

  // Cards for the active source: plain platform card (year-less) plus any
  // year-split accsmarket-style cards ("<sourceId>-<yearKey>") for that source.
  const activePlatforms = (accountsStock?.platforms ?? []).filter((p) => p.id === activeSourceId)
  const activeAccsmarketPlatforms = (accsmarketStock?.platforms ?? []).filter((p) => p.id.startsWith(`${activeSourceId}-`))
  const activeTotalStock = activePlatforms.reduce((s, p) => s + p.total_stock, 0)
    + activeAccsmarketPlatforms.reduce((s, p) => s + p.total_stock, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ringkasan performa bisnis</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} color={s.color} loading={isLoading} />
        ))}
      </div>

      {/* Stock Summary */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ringkasan Stok</h2>
          <p className="text-xs text-muted-foreground">Distribusi stok berdasarkan source</p>
        </div>

        {/* Tabs — one per Source */}
        <div className="flex border-b border-border overflow-x-auto overflow-y-hidden">
          {sources.map((s) => {
            const total = (accountsStock?.platforms ?? []).filter((p) => p.id === s.id).reduce((sum, p) => sum + p.total_stock, 0)
              + (accsmarketStock?.platforms ?? []).filter((p) => p.id.startsWith(`${s.id}-`)).reduce((sum, p) => sum + p.total_stock, 0)
            return (
              <button
                key={s.id}
                onClick={() => setActiveSourceId(s.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeSourceId === s.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.name}
                {!isLoading && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {total.toLocaleString("id-ID")}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Platform grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : activeTotalStock === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada stok untuk source ini.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePlatforms.map((p) => (
              <PlatformCard key={p.id ?? p.name} {...p} />
            ))}
            {activeAccsmarketPlatforms.map((p) => (
              <AccsmarketCard key={p.id} {...p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
