import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, X, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { EmptyRow, LoadingRow } from "@/components/ui/table-extras"
import { Card, CardContent } from "@/components/ui/card"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"

interface Testimonial {
  id: number
  product: { id: number; title: string }
  createdBy: { id: number; name: string }
  customerName: string
  message: string
  rating: number
  avatar?: string
  isPublished: boolean
  createdAt: string
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  )
}

export default function TestimonialsPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()

  const { data, isLoading } = useQuery<Testimonial[]>({
    queryKey: ["testimonials"],
    queryFn: () => api.get("/testimonials").then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      api.patch(`/testimonials/${id}`, { isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] })
      alert.success("Berhasil", "Testimoni berhasil diperbarui")
    },
    onError: () => {
      alert.error("Gagal", "Gagal memperbarui testimoni")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/testimonials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] })
      alert.success("Berhasil", "Testimoni berhasil dihapus")
    },
    onError: () => {
      alert.error("Gagal", "Gagal menghapus testimoni")
    },
  })

  const handlePublish = (id: number, publish: boolean) =>
    toggleMutation.mutate({ id, isPublished: publish })

  const handleDelete = async (t: Testimonial) => {
    const ok = await alert.confirm("Hapus Testimoni", `Hapus testimoni dari "${t.customerName}"?`)
    if (ok) deleteMutation.mutate(t.id)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Testimoni</h1>
        <p className="text-sm text-muted-foreground mt-1">Ulasan produk dari pelanggan</p>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Pesan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <LoadingRow colSpan={7} />
              ) : !data?.length ? (
                <EmptyRow colSpan={7} message="Tidak ada testimoni" />
              ) : (
                data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">{t.customerName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                      {t.product.title}
                    </TableCell>
                    <TableCell>
                      <RatingStars rating={t.rating} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {t.message}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.isPublished ? "completed" : "warning"}>
                        {t.isPublished ? "Tayang" : "Disembunyikan"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`size-8 ${t.isPublished ? "text-muted-foreground" : "text-emerald-600 hover:text-emerald-600"}`}
                          onClick={() => handlePublish(t.id, !t.isPublished)}
                          title={t.isPublished ? "Sembunyikan" : "Tayangkan"}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(t)}
                          title="Hapus"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
