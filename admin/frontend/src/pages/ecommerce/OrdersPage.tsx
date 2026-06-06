import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dropdown } from "@/components/ui/dropdown-select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface Order {
  id: number
  groupId?: string
  user: { id: number; name: string; email: string }
  product: { id: number; title: string }
  totalPrice: number
  status: string
  bankAccount?: { bankName: string; accountNumber: string }
  createdAt: string
}

interface OrdersResponse {
  data: Order[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "pending", label: "Pending" },
  { value: "waiting_confirmation", label: "Menunggu Verifikasi" },
  { value: "paid", label: "Lunas" },
  { value: "cancelled", label: "Dibatalkan" },
]

const statusVariant: Record<string, "warning" | "blue" | "completed" | "error"> = {
  pending: "warning",
  waiting_confirmation: "blue",
  paid: "completed",
  cancelled: "error",
}

const statusLabel: Record<string, string> = {
  pending: "Pending",
  waiting_confirmation: "Menunggu Verifikasi",
  paid: "Lunas",
  cancelled: "Dibatalkan",
}

const PAGE_SIZE = 20

export default function OrdersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")

  const { data, isLoading } = useQuery<OrdersResponse>({
    queryKey: ["orders", page, search, status],
    queryFn: () =>
      api
        .get("/orders", { params: { page, limit: PAGE_SIZE, search: search || undefined, status: status || undefined } })
        .then((r) => r.data),
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pesanan</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola pesanan pelanggan</p>
      </div>

      {/* Filters — column on mobile (search first), row on sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau email pelanggan..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Dropdown
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => { setStatus(v); setPage(1) }}
          className="w-full sm:w-44"
        />
      </div>

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <LoadingRow colSpan={6} />
              ) : !data?.data?.length ? (
                <EmptyRow colSpan={6} message="Tidak ada pesanan ditemukan" />
              ) : (
                data.data.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/ecommerce/orders/${order.id}`)}
                  >
                    <TableCell className="font-mono text-xs">#{order.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{order.user.name}</p>
                        <p className="text-xs text-muted-foreground">{order.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                      {order.product.title}
                    </TableCell>
                    <TableCell className="font-medium">{formatIDR(order.totalPrice)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[order.status] ?? "outline"}>
                        {statusLabel[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(order.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            total={data?.meta?.total ?? 0}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
        ) : !data?.data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Tidak ada pesanan ditemukan</p>
        ) : (
          data.data.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer active:opacity-70"
              onClick={() => navigate(`/ecommerce/orders/${order.id}`)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{order.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{order.user.email}</p>
                  </div>
                  <Badge variant={statusVariant[order.status] ?? "outline"} className="shrink-0">
                    {statusLabel[order.status] ?? order.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{order.product.title}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">#{order.id}</span>
                  <span className="font-semibold text-foreground text-sm">{formatIDR(order.totalPrice)}</span>
                  <span>
                    {new Date(order.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {!!data?.data?.length && (
          <Pagination
            page={page}
            total={data?.meta?.total ?? 0}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        )}
      </div>
    </div>
  )
}
