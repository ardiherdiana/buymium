import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Plus, Trash2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { EmptyRow, LoadingRow, Pagination } from "@/components/ui/table-extras"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"

interface Stock {
  id: number
  product?: { id: number; title: string }
  username: string
  email?: string
  password: string
  status: string
  createdAt: string
}

interface StocksResponse {
  data: Stock[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

interface Product {
  id: number
  title: string
}

const PAGE_SIZE = 100

// Parse bulk lines using a delimiter
// Format: email|pass_email|username|password|2fa
function parseBulkLines(raw: string, delimiter: string) {
  const sep = delimiter || "|"
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(sep)
      return {
        email: parts[0] || undefined,
        password_email: parts[1] || undefined,
        username: parts[2] || "",
        password: parts[3] || "",
        two_factor_code: parts[4] || undefined,
      }
    })
    .filter((item) => item.username || item.email)
}

// ─── Upload page ────────────────────────────────────────────────────────────

function UploadPage() {
  const alert = useAlert()
  const queryClient = useQueryClient()

  const [productId, setProductId] = useState("")
  const [delimiter, setDelimiter] = useState("|")
  const [raw, setRaw] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ["products-list"],
    queryFn: () => api.get("/products", { params: { limit: 100 } }).then((r) => r.data),
  })

  const products = productsData?.data ?? []
  const parsed = parseBulkLines(raw, delimiter)

  const handleSubmit = async () => {
    if (!productId) { alert.error("Validasi", "Pilih produk terlebih dahulu"); return }
    if (parsed.length === 0) { alert.error("Validasi", "Tidak ada data valid yang ditemukan"); return }
    setIsLoading(true)
    try {
      await api.post("/stocks/bulk", { productId: parseInt(productId), data: parsed })
      alert.success("Berhasil", `${parsed.length} stok berhasil disimpan`)
      setRaw("")
      queryClient.invalidateQueries({ queryKey: ["stocks"] })
    } catch {
      alert.error("Gagal", "Gagal menyimpan data stok")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Kelola Stok Akun</h1>
      </div>

      <div className="grid grid-cols-[380px_1fr] gap-6 items-start">
        {/* Left — settings */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold">Pilih & Atur</p>

              <div className="space-y-1.5">
                <Label>Pilih Produk</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="-- Pilih Produk --" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Pemisah Kolom (Delimiter)</Label>
                <Input
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  placeholder="|"
                  className="font-mono"
                />
              </div>

              {/* Format info */}
              <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="size-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">i</span>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">INFORMASI FORMAT</span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400">Format per baris:</p>
                <p className="text-xs font-mono text-blue-700 dark:text-blue-300">
                  email{delimiter}pass_email{delimiter}username{delimiter}password{delimiter}2fa
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Minimal:</p>
                <p className="text-xs font-mono text-blue-700 dark:text-blue-300">
                  {delimiter}username{delimiter}password
                </p>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                <Send className="size-4" />
                {isLoading ? "Menyimpan..." : "Simpan Data Stok"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right — bulk input */}
        <Card className="h-full">
          <CardContent className="p-5 h-full flex flex-col">
            <p className="text-sm font-semibold mb-3">Input Data Massal</p>
            <Textarea
              className="flex-1 font-mono text-xs resize-none min-h-[360px]"
              placeholder={`Masukkan data akun di sini, satu baris per akun...\nContoh:\nadit@mail.com${delimiter}secret123${delimiter}adit_id${delimiter}passID${delimiter}667788`}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            {raw && (
              <p className="text-xs text-muted-foreground mt-2">
                {parsed.length} baris valid terdeteksi
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Product stock table ─────────────────────────────────────────────────────

function ProductStockTable({ productId }: { productId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [page, setPage] = useState(1)
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data, isLoading } = useQuery<StocksResponse>({
    queryKey: ["stocks", productId, page],
    queryFn: () =>
      api.get(`/stocks/product/${productId}`, { params: { page, limit: PAGE_SIZE } }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/stocks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks", productId] })
      alert.success("Berhasil", "Stok berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus stok"),
  })

  const handleDelete = async (stock: Stock) => {
    const ok = await alert.confirm("Hapus Stok", "Hapus stok ini?")
    if (ok) deleteMutation.mutate(stock.id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ecommerce/products")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Stok Produk</h1>
          <p className="text-sm text-muted-foreground">{data?.meta?.total ?? 0} stok</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="size-4 mr-2" />
          Upload Stok
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ditambahkan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <LoadingRow colSpan={5} />
              ) : !data?.data?.length ? (
                <EmptyRow colSpan={5} message="Tidak ada stok ditemukan" />
              ) : (
                data.data.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-mono text-xs">{stock.username}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{stock.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={stock.status === "sold" ? "outline" : "completed"}>
                        {stock.status === "sold" ? "Terjual" : "Tersedia"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(stock.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(stock)}
                        disabled={stock.status === "sold"}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination page={page} total={data?.meta?.total ?? 0} pageSize={PAGE_SIZE} onChange={setPage} />
        </CardContent>
      </Card>

      {/* Inline upload panel */}
      {uploadOpen && (
        <Card>
          <CardContent className="p-5">
            <InlineUpload
              productId={productId}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["stocks", productId] })
                setUploadOpen(false)
              }}
              onCancel={() => setUploadOpen(false)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InlineUpload({
  productId,
  onSuccess,
  onCancel,
}: {
  productId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const alert = useAlert()
  const [delimiter, setDelimiter] = useState("|")
  const [raw, setRaw] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const parsed = parseBulkLines(raw, delimiter)

  const handleSubmit = async () => {
    if (parsed.length === 0) { alert.error("Validasi", "Tidak ada data valid"); return }
    setIsLoading(true)
    try {
      await api.post("/stocks/bulk", { productId: parseInt(productId), data: parsed })
      alert.success("Berhasil", `${parsed.length} stok berhasil disimpan`)
      onSuccess()
    } catch {
      alert.error("Gagal", "Gagal menyimpan stok")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-[320px_1fr] gap-5 items-start">
      <div className="space-y-4">
        <p className="text-sm font-semibold">Pilih & Atur</p>
        <div className="space-y-1.5">
          <Label>Pemisah Kolom (Delimiter)</Label>
          <Input value={delimiter} onChange={(e) => setDelimiter(e.target.value)} className="font-mono w-24" />
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="size-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">i</span>
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">INFORMASI FORMAT</span>
          </div>
          <p className="text-xs font-mono text-blue-700 dark:text-blue-300">
            email{delimiter}pass_email{delimiter}username{delimiter}password{delimiter}2fa
          </p>
          <p className="text-xs font-mono text-blue-700 dark:text-blue-300">
            Minimal: {delimiter}username{delimiter}password
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={isLoading}>
            <Send className="size-4" />
            {isLoading ? "Menyimpan..." : "Simpan"}
          </Button>
          <Button variant="outline" onClick={onCancel}>Batal</Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Input Data Massal</p>
        <Textarea
          className="font-mono text-xs min-h-[200px]"
          placeholder={`Masukkan data akun...\nContoh: email${delimiter}pass_email${delimiter}username${delimiter}password`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        {raw && <p className="text-xs text-muted-foreground">{parsed.length} baris valid</p>}
      </div>
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function StockPage() {
  const { id: productId } = useParams<{ id: string }>()
  if (productId) return <ProductStockTable productId={productId} />
  return <UploadPage />
}
