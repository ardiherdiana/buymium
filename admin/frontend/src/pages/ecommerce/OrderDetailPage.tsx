import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR, getProofImageUrl } from "@/lib/config"

interface InventoryItem {
  id: number
  username: string | null
  email: string | null
  password: string | null
}

interface OrderDetail {
  id: number
  groupId?: string
  user: { id: number; name: string; email: string }
  product: { id: number; title: string; section?: { title: string } }
  totalPrice: number
  quantity: number
  status: string
  paymentProof?: string
  notes?: string
  createdAt: string
  bankAccount?: { bankName: string; accountNumber: string; accountHolder: string }
  inventoryItems: InventoryItem[]
  relatedOrders: OrderDetail[]
}

const statusVariant: Record<string, "warning" | "blue" | "completed" | "error"> = {
  pending: "warning",
  awaiting_confirmation: "blue",
  paid: "completed",
  cancelled: "error",
}

const statusLabel: Record<string, string> = {
  pending: "Pending",
  awaiting_confirmation: "Menunggu Verifikasi",
  paid: "Lunas",
  cancelled: "Dibatalkan",
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const alert = useAlert()

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ["order", id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const [rejectNote, setRejectNote] = useState("")
  const [proofPreviewOpen, setProofPreviewOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/orders/${id}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      alert.success("Berhasil", "Pesanan dikonfirmasi dan akun telah dikirim")
    },
    onError: () => {
      alert.error("Gagal", "Gagal mengonfirmasi pesanan")
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/orders/${id}/reject`, { adminNote: rejectNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      alert.success("Berhasil", "Pesanan ditolak")
      setRejectNote("")
      setRejectDialogOpen(false)
    },
    onError: () => {
      alert.error("Gagal", "Gagal menolak pesanan")
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Pesanan tidak ditemukan</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/ecommerce/orders")}>
          Kembali
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ecommerce/orders")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pesanan #{order.id}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Badge variant={statusVariant[order.status] ?? "outline"} className="ml-auto">
          {statusLabel[order.status] ?? order.status}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Info Pelanggan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nama</span>
            <span className="font-medium">{order.user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{order.user.email}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Produk</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p className="font-medium">{order.product.title}</p>
          {order.product.section && (
            <p className="text-muted-foreground">{order.product.section.title}</p>
          )}
          <p className="text-muted-foreground">Qty: {order.quantity}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Info Pembayaran</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {order.bankAccount && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rekening</span>
              <span className="font-medium">
                {order.bankAccount.bankName} · {order.bankAccount.accountNumber}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold text-foreground">{formatIDR(order.totalPrice)}</span>
          </div>
          {order.notes && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Catatan</span>
              <span className="text-right">{order.notes}</span>
            </div>
          )}
          {order.paymentProof && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bukti Pembayaran</span>
              <button
                type="button"
                onClick={() => setProofPreviewOpen(true)}
                className="font-medium text-primary underline underline-offset-2"
              >
                Lihat
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {order.inventoryItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {order.status === "paid" ? "Akun Terkirim" : "Kredensial Akun (akan dikirim)"}
            </CardTitle>
          </CardHeader>
          {/* Desktop: table */}
          <CardContent className="p-0 hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Password</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.inventoryItems.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-mono text-xs">{stock.username}</TableCell>
                    <TableCell className="font-mono text-xs">{stock.email || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{stock.password}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          {/* Mobile: cards */}
          <CardContent className="sm:hidden p-4 space-y-3">
            {order.inventoryItems.map((stock) => (
              <div key={stock.id} className="rounded-md border p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-mono font-medium">{stock.username}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-mono">{stock.email || "-"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Password</span>
                  <span className="font-mono">{stock.password}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {order.status === "awaiting_confirmation" && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            className="w-full sm:w-auto"
            disabled={confirmMutation.isPending}
            onClick={() => confirmMutation.mutate()}
          >
            {confirmMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Konfirmasi Pembayaran & Kirim Akun
          </Button>

          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => setRejectDialogOpen(true)}
          >
            Tolak Pesanan
          </Button>
        </div>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Tolak Pesanan</DialogTitle>
          <Textarea
            placeholder="Alasan penolakan (wajib diisi)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
          />
          <Button
            variant="destructive"
            className="w-full"
            disabled={!rejectNote.trim() || rejectMutation.isPending}
            onClick={() => rejectMutation.mutate()}
          >
            {rejectMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Tolak Pesanan
          </Button>
        </DialogContent>
      </Dialog>

      {order?.paymentProof && (
        <Dialog open={proofPreviewOpen} onOpenChange={setProofPreviewOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogTitle>Bukti Pembayaran</DialogTitle>
            <img
              src={getProofImageUrl(order.paymentProof)}
              alt="Bukti pembayaran"
              className="w-full rounded-md border object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
