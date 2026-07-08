import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface SaleLine {
  id: number
  account?: { username: string; email: string; targetFollowers?: number }
  unit_sale_price: number
  profit: number
}

interface SaleDetail {
  id: number
  sales_number?: string
  customer?: { usernameSh: string; nomorHp?: string }
  source?: { name: string }
  total_sale_price: number
  total_profit: number
  is_shopee: boolean
  origin: "storefront" | "manual"
  buyer?: { name: string; email: string }
  created_at: string
  sale_lines: SaleLine[]
}

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: sale, isLoading } = useQuery<SaleDetail>({
    queryKey: ["management-sale", id],
    queryFn: () => api.get(`/management/sales/${id}`).then((r) => r.data.sale),
    enabled: !!id,
  })

  if (isLoading) return (
    <div className="space-y-5"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
  )

  if (!sale) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Penjualan tidak ditemukan</p>
      <Button variant="ghost" className="mt-4" onClick={() => navigate("/finance/sales")}>Kembali</Button>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/finance/sales")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Penjualan #{sale.id}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(sale.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Info Pelanggan</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Asal</span>
              <span className="font-medium">{sale.origin === "storefront" ? "Storefront" : "Manual"}</span>
            </div>
            {sale.origin === "storefront" ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nama</span>
                  <span className="font-medium">{sale.buyer?.name ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{sale.buyer?.email ?? "-"}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-medium">{sale.customer?.usernameSh ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nomor HP</span>
                  <span>{sale.customer?.nomorHp ?? "-"}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <span>{sale.source?.name ?? "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shopee</span>
              <span>{sale.is_shopee ? "Ya" : "Tidak"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Ringkasan</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Harga Jual</span>
              <span className="font-semibold">{formatIDR(sale.total_sale_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Profit</span>
              <span className="font-semibold text-emerald-600">{formatIDR(sale.total_profit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modal</span>
              <span>{formatIDR(sale.total_sale_price - sale.total_profit)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Item Terjual ({sale.sale_lines?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Target Followers</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.sale_lines?.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">@{line.account?.username ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{line.account?.email ?? "-"}</TableCell>
                  <TableCell>{line.account?.targetFollowers?.toLocaleString("id-ID") ?? "-"}</TableCell>
                  <TableCell className="text-right">{formatIDR(line.unit_sale_price)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{formatIDR(line.profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
