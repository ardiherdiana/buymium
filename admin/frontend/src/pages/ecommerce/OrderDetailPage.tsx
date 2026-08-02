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
  passwordEmail?: string | null
  twoFactorAuth?: string | null
  currentFollowers?: number | null
  targetFollowers?: number | null
  accountStatus?: string | null
  loginApp?: string | null
  phoneModel?: string | null
  year?: string | null
  capital?: number | null
}

interface OrderDetail {
  id: number
  groupId?: string
  user: { id: number; name: string; email: string }
  product: { id: number; title: string; section?: { title: string } }
  totalPrice: number
  subtotal?: number
  quantity: number
  variantLabel?: string | null
  status: string
  paymentProofUrl?: string | null
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

function AccountStatusBadge({ status }: { status?: string | null }) {
  const s = status?.toLowerCase()
  return (
    <Badge variant={s === "completed" ? "completed" : s === "error" ? "destructive" : "progress"}>
      {s === "completed" ? "Selesai" : s === "error" ? "Error" : "Proses"}
    </Badge>
  )
}

function AccountCredentials({ items }: { items: InventoryItem[] }) {
  return (
    <>
      {/* Desktop: table */}
      <CardContent className="p-0 hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Password Email</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Saat Ini</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aplikasi Login</TableHead>
              <TableHead>Modal</TableHead>
              <TableHead>HP</TableHead>
              <TableHead>Tahun</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((acc) => (
              <TableRow key={acc.id}>
                <TableCell className="text-xs text-muted-foreground">{acc.email ?? "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{acc.passwordEmail ?? "-"}</TableCell>
                <TableCell className="font-medium text-sm">{acc.username ?? "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{acc.password ?? "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{acc.twoFactorAuth ?? "-"}</TableCell>
                <TableCell>{acc.currentFollowers?.toLocaleString("id-ID") ?? "-"}</TableCell>
                <TableCell>{acc.targetFollowers?.toLocaleString("id-ID") ?? "-"}</TableCell>
                <TableCell><AccountStatusBadge status={acc.accountStatus} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{acc.loginApp ?? "-"}</TableCell>
                <TableCell>{acc.capital ? formatIDR(acc.capital) : "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{acc.phoneModel ?? "-"}</TableCell>
                <TableCell className="text-xs">{acc.year ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {/* Mobile: cards */}
      <CardContent className="sm:hidden p-4 space-y-3">
        {items.map((acc) => (
          <div key={acc.id} className="rounded-md border p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{acc.username ?? "-"}</p>
                <p className="text-xs text-muted-foreground truncate">{acc.email ?? "-"}</p>
              </div>
              <AccountStatusBadge status={acc.accountStatus} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Password Email</span>
              <span className="font-mono">{acc.passwordEmail ?? "-"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Password</span>
              <span className="font-mono">{acc.password ?? "-"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">2FA</span>
              <span className="font-mono">{acc.twoFactorAuth ?? "-"}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Followers</span>
                <span className="font-medium">{acc.currentFollowers?.toLocaleString("id-ID") ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target</span>
                <span className="font-medium">{acc.targetFollowers?.toLocaleString("id-ID") ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modal</span>
                <span className="font-medium">{acc.capital ? formatIDR(acc.capital) : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">HP</span>
                <span className="font-medium truncate">{acc.phoneModel ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tahun</span>
                <span className="font-medium">{acc.year ?? "-"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
              {acc.loginApp ?? "-"}
            </div>
          </div>
        ))}
      </CardContent>
    </>
  )
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

  const allOrders = order.relatedOrders?.length > 0 ? order.relatedOrders : [order]
  const grandSubtotal = allOrders.reduce((s, o) => s + (o.subtotal ?? o.totalPrice), 0)
  const grandTotal = grandSubtotal

  // Same product bought across multiple follower tiers (e.g. 1K + 2K) should read as
  // one product card with each variant as a sub-row, not a repeated product block.
  const productGroups: { product: OrderDetail["product"]; items: OrderDetail[] }[] = []
  for (const o of allOrders) {
    let group = productGroups.find((g) => g.product.id === o.product.id)
    if (!group) { group = { product: o.product, items: [] }; productGroups.push(group) }
    group.items.push(o)
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
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {productGroups.map(({ product, items }) => (
              <div key={product.id}>
                <div className="px-5 pt-4 pb-2">
                  <p className="font-medium text-sm truncate">{product.title}</p>
                  {product.section && (
                    <p className="text-xs text-muted-foreground">{product.section.title}</p>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variasi</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-sm">{o.variantLabel ?? "-"}</TableCell>
                        <TableCell className="text-right text-sm">{o.quantity}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{formatIDR(o.subtotal ?? o.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
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
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatIDR(grandSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold text-foreground">{formatIDR(grandTotal)}</span>
          </div>
          {order.notes && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Catatan</span>
              <span className="text-right">{order.notes}</span>
            </div>
          )}
          {order.paymentProofUrl && (
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
          <AccountCredentials items={order.inventoryItems} />
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

      {order?.paymentProofUrl && (
        <Dialog open={proofPreviewOpen} onOpenChange={setProofPreviewOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogTitle>Bukti Pembayaran</DialogTitle>
            <img
              src={getProofImageUrl(order.paymentProofUrl)}
              alt="Bukti pembayaran"
              className="w-full rounded-md border object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
