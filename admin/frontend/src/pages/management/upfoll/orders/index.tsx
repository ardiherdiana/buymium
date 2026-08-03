import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Trash2, RefreshCw, ShoppingCart, Users, TrendingUp, Wallet } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { Fab } from "@/components/ui/fab"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

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
  const [page, setPage] = useState(1)
  const [scanningId, setScanningId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<OrdersResponse>({
    queryKey: ["upfoll-orders", page, search],
    queryFn: () =>
      api.get("/management/upfoll-orders", { params: { page, search: search || undefined } }).then((r) => r.data),
  })

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

      <Input
        placeholder="Cari nomor pesanan / customer / username IG..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        className="w-full sm:w-72"
      />

      <div className="flex flex-col gap-3">
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

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username IG</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Followers</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">@{item.username}</TableCell>
                      <TableCell className="text-muted-foreground">{item.vendor_tier.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.vendor_tier.vendor.name}</TableCell>
                      <TableCell className="text-right">
                        {item.current_followers?.toLocaleString("id-ID") ?? "-"} / {item.target_followers.toLocaleString("id-ID")}
                        {item.starting_followers != null && (
                          <p className="text-[10px] text-muted-foreground">awal {item.starting_followers.toLocaleString("id-ID")}</p>
                        )}
                      </TableCell>
                      <TableCell className={`text-right ${item.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatIDR(item.profit)}
                      </TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="icon" className="size-7"
                          disabled={scanningId === item.id || item.status === "selesai"}
                          onClick={() => handleScan(item.id)}
                        >
                          <RefreshCw className={`size-3.5 ${scanningId === item.id ? "animate-spin" : ""}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
        {orders.length > 0 && (
          <Pagination page={page} total={pagination?.total ?? 0} pageSize={pagination?.limit ?? 15} onChange={setPage} />
        )}
      </div>

      <Fab onClick={() => navigate("/upfoll/orders/new")} title="Tambah Pesanan" />
    </div>
  )
}
