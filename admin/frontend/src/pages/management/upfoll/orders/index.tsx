import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Trash2, RefreshCw, ShoppingCart, Users, TrendingUp, Wallet, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dropdown } from "@/components/ui/dropdown-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { Fab } from "@/components/ui/fab"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "selesai", label: "Selesai" },
  { value: "progress", label: "Progress" },
]

interface VendorRef { id: number; name: string }
interface VendorTier { id: number; name: string; target_followers: number; vendor: VendorRef }
interface Item {
  id: number
  username: string
  starting_followers: number | null
  current_followers: number | null
  target_followers: number
  status: "progress" | "selesai"
  capital: number
  unit_sale_price: number
  profit: number
  vendor_tier: VendorTier
}
interface Order {
  id: number
  order_number: string
  customer?: { id: number; username_shopee: string }
  total_sale_price: number
  total_profit: number
  is_shopee: boolean
  created_at: string
  items: Item[]
}
interface OrdersResponse {
  orders: Order[]
  pagination: { page: number; limit: number; total: number; pages: number }
  stats: { total_orders: number; total_usernames: number; total_followers: number; total_sale_price: number; total_profit: number }
}
interface VendorOption { id: number; name: string }

function StatusBadge({ status }: { status: Item["status"] }) {
  return status === "selesai" ? (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      Selesai
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      Progress
    </span>
  )
}

export default function UpfollOrdersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const alert = useAlert()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [vendorId, setVendorId] = useState("all")
  const [page, setPage] = useState(1)
  const [scanningId, setScanningId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<OrdersResponse>({
    queryKey: ["upfoll-orders", page, search, status, vendorId],
    queryFn: () =>
      api.get("/management/upfoll-orders", {
        params: {
          page,
          search: search || undefined,
          status: status !== "all" ? status : undefined,
          vendor_id: vendorId !== "all" ? vendorId : undefined,
        },
      }).then((r) => r.data),
  })

  const { data: vendorsData } = useQuery<{ vendors: VendorOption[] }>({
    queryKey: ["upfoll-vendors-filter"],
    queryFn: () => api.get("/management/upfoll-vendors").then((r) => r.data),
  })
  const vendorOptions = [{ value: "all", label: "Semua Vendor" }, ...(vendorsData?.vendors ?? []).map((v) => ({ value: String(v.id), label: v.name }))]

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/management/upfoll-orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upfoll-orders"] })
      alert.success("Berhasil", "Pesanan berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus pesanan"),
  })

  const handleDelete = async (order: Order) => {
    const ok = await alert.confirm("Hapus Pesanan", `Hapus pesanan ${order.order_number}?`)
    if (ok) deleteMut.mutate(order.id)
  }

  const handleScan = async (itemId: number) => {
    setScanningId(itemId)
    try {
      await api.post(`/management/upfoll-orders/items/${itemId}/refresh-followers`)
      qc.invalidateQueries({ queryKey: ["upfoll-orders"] })
      alert.success("Berhasil", "Followers berhasil di-scan")
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal scan followers"
      alert.error("Gagal", msg)
    } finally {
      setScanningId(null)
    }
  }

  const orders = data?.orders ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Pesanan Upfoll</h1>
        <p className="text-sm text-muted-foreground mt-1">Follow-for-tag organik</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatCard title="Total Pesanan" value={(data?.stats.total_orders ?? 0).toLocaleString("id-ID")} icon={ShoppingCart} color="blue" />
        <StatCard title="Total Username" value={(data?.stats.total_usernames ?? 0).toLocaleString("id-ID")} icon={Users} color="violet" />
        <StatCard title="Total Omset" value={formatIDR(data?.stats.total_sale_price ?? 0)} icon={Wallet} color="muted" />
        <StatCard title="Total Profit" value={formatIDR(data?.stats.total_profit ?? 0)} icon={TrendingUp} valueClass="text-green-600" color="emerald" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Cari &amp; Filter</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nomor pesanan / customer / username IG..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Status</p>
              <Dropdown options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1) }} className="w-full" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Vendor</p>
              <Dropdown options={vendorOptions} value={vendorId} onChange={(v) => { setVendorId(v); setPage(1) }} className="w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pesanan</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Username IG</TableHead>
                <TableHead>Vendor / Tier</TableHead>
                <TableHead className="text-right">Followers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
              ) : !orders.length ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Belum ada pesanan upfoll</TableCell></TableRow>
              ) : (
                orders.flatMap((order) =>
                  order.items.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {idx === 0 && (
                          <>
                            <p className="font-mono text-xs">{order.order_number}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                              {order.is_shopee && " · Shopee"}
                            </p>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{idx === 0 ? (order.customer?.username_shopee ?? "-") : ""}</TableCell>
                      <TableCell className="font-medium">@{item.username}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{item.vendor_tier.vendor.name} · {item.vendor_tier.name}</TableCell>
                      <TableCell className="text-right">
                        {item.current_followers?.toLocaleString("id-ID") ?? "-"} / {item.target_followers.toLocaleString("id-ID")}
                        {item.starting_followers != null && (
                          <p className="text-[10px] text-muted-foreground">awal {item.starting_followers.toLocaleString("id-ID")}</p>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="text-right">{formatIDR(item.unit_sale_price)}</TableCell>
                      <TableCell className={`text-right ${item.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatIDR(item.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            disabled={scanningId === item.id || item.status === "selesai"}
                            onClick={() => handleScan(item.id)}
                          >
                            <RefreshCw className={`size-3.5 ${scanningId === item.id ? "animate-spin" : ""}`} />
                          </Button>
                          {idx === 0 && (
                            <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => handleDelete(order)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
        ) : !orders.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada pesanan upfoll</p>
        ) : orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{order.order_number}</p>
                  <p className="font-medium text-sm">{order.customer?.username_shopee ?? "-"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    {order.is_shopee && " · Shopee"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatIDR(order.total_sale_price)}</p>
                  <p className={`text-xs font-medium ${order.total_profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    Profit: {formatIDR(order.total_profit)}
                  </p>
                  <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => handleDelete(order)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t pt-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium">@{item.username}</p>
                      <p className="text-xs text-muted-foreground">{item.vendor_tier.vendor.name} · {item.vendor_tier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.current_followers?.toLocaleString("id-ID") ?? "-"} / {item.target_followers.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={item.status} />
                      <p className={`text-xs font-medium mt-1 ${item.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatIDR(item.profit)}
                      </p>
                      <Button
                        variant="ghost" size="icon" className="size-6"
                        disabled={scanningId === item.id || item.status === "selesai"}
                        onClick={() => handleScan(item.id)}
                      >
                        <RefreshCw className={`size-3.5 ${scanningId === item.id ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {orders.length > 0 && (
        <Pagination page={page} total={pagination?.total ?? 0} pageSize={pagination?.limit ?? 15} onChange={setPage} />
      )}

      <Fab onClick={() => navigate("/upfoll/orders/new")} title="Tambah Pesanan" />
    </div>
  )
}
