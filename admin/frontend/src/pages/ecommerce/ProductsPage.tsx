import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Search, Plus, Pencil, Trash2, Eye } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface Product {
  id: number
  title: string
  price: number
  stocks?: { id: number }[]
  isActive: boolean
  imageUrl?: string
}

interface ProductsResponse {
  data: Product[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

const PAGE_SIZE = 20

export default function ProductsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["products", page, search],
    queryFn: () =>
      api.get("/products", { params: { page, limit: PAGE_SIZE, search: search || undefined } }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      alert.success("Berhasil", "Produk berhasil dihapus")
    },
    onError: () => {
      alert.error("Gagal", "Gagal menghapus produk")
    },
  })

  const handleDelete = async (product: Product) => {
    const ok = await alert.confirm("Hapus Produk", `Hapus produk "${product.title}"? Tindakan ini tidak dapat dibatalkan.`)
    if (ok) deleteMutation.mutate(product.id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Produk</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola katalog produk</p>
        </div>
        <Button onClick={() => navigate("/ecommerce/products/add")}>
          <Plus className="size-4 mr-2" />
          Tambah Produk
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="pl-9"
        />
      </div>

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
        <CardContent className="p-0">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Produk</TableHead>
                <TableHead className="w-[15%]">Harga</TableHead>
                <TableHead className="w-[10%]">Stok</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[10%] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <LoadingRow colSpan={6} />
              ) : !data?.data?.length ? (
                <EmptyRow colSpan={6} message="Tidak ada produk ditemukan" />
              ) : (
                data.data.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="max-w-0">
                      <span className="font-medium truncate block">{product.title}</span>
                    </TableCell>
                    <TableCell className="font-medium">{formatIDR(product.price)}</TableCell>
                    <TableCell>{product.stocks?.length ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "completed" : "outline"}>
                        {product.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => navigate(`/ecommerce/products/${product.id}/stocks`)}
                          title="Kelola Stok"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => navigate(`/ecommerce/products/${product.id}/edit`)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(product)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
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
          <p className="text-sm text-muted-foreground text-center py-8">Tidak ada produk ditemukan</p>
        ) : (
          data.data.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-sm leading-tight truncate">{product.title}</p>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">{formatIDR(product.price)}</span>
                      <span className="text-xs text-muted-foreground">{product.stocks?.length ?? 0} stok</span>
                    </div>
                  </div>
                  <Badge variant={product.isActive ? "completed" : "outline"} className="shrink-0">
                    {product.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                <div className="flex items-center justify-end gap-1 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => navigate(`/ecommerce/products/${product.id}/stocks`)}
                    title="Kelola Stok"
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => navigate(`/ecommerce/products/${product.id}/edit`)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(product)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
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
