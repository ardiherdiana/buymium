import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  DollarSign, TrendingUp, Users, Package, Activity, UserSquare,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

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
}

interface Platform {
  id: number | null | undefined
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

function StatCard({
  title, value, icon: Icon, loading,
}: { title: string; value: string; icon: React.ElementType; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 pt-3 sm:pt-6 px-3 sm:px-6">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-3.5 sm:size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
        {loading
          ? <Skeleton className="h-6 sm:h-7 w-24 sm:w-32" />
          : <p className="text-lg sm:text-2xl font-bold text-foreground">{value}</p>}
      </CardContent>
    </Card>
  )
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

type StockTab = "accounts" | "accsmarket"

export default function ManagementDashboard() {
  const [activeTab, setActiveTab] = useState<StockTab>("accounts")

  const { data, isLoading } = useQuery<DashboardResponse>({
    queryKey: ["management-dashboard"],
    queryFn: () => api.get("/management/dashboard").then((r) => r.data),
  })

  const stats = data?.statistics
  const accountsStock = data?.accounts_stock
  const accsmarketStock = data?.accsmarket_stock

  const statCards = [
    { title: "Total Revenue", value: formatIDR(stats?.total_revenue ?? 0), icon: DollarSign },
    { title: "Total Profit", value: formatIDR(stats?.total_profit ?? 0), icon: TrendingUp },
    { title: "Total Users", value: (stats?.total_users ?? 0).toLocaleString("id-ID"), icon: Users },
    { title: "Total Accounts", value: (stats?.total_accounts ?? 0).toLocaleString("id-ID"), icon: Package },
    { title: "Active Accounts", value: (stats?.active_accounts ?? 0).toLocaleString("id-ID"), icon: Activity },
    { title: "Total Customers", value: (stats?.total_customers ?? 0).toLocaleString("id-ID"), icon: UserSquare },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ringkasan performa bisnis</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} loading={isLoading} />
        ))}
      </div>

      {/* Stock Summary */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Stock Summary</h2>
          <p className="text-xs text-muted-foreground">Distribusi stok berdasarkan platform dan tipe produk</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto">
          {([
            { key: "accounts" as const, label: "Accounts", total: accountsStock?.total_stock },
            { key: "accsmarket" as const, label: "Accsmarket", total: accsmarketStock?.total_stock },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.total != null && !isLoading && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {tab.total.toLocaleString("id-ID")}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Platform grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : activeTab === "accounts" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(accountsStock?.platforms ?? []).map((p) => (
              <PlatformCard key={p.id ?? p.name} {...p} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(accsmarketStock?.platforms ?? []).map((p) => (
              <AccsmarketCard key={p.id} {...p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
