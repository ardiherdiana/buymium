import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { X, Star } from "lucide-react"
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

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/testimonials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] })
      alert.success("Berhasil", "Testimoni berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus testimoni"),
  })

  const handleDelete = async (t: Testimonial) => {
    const ok = await alert.confirm("Hapus Testimoni", `Hapus testimoni dari "${t.customerName}"?`)
    if (ok) deleteMutation.mutate(t.id)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Testimoni</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ulasan dari pelanggan setelah pesanan selesai. Rating 1-3 otomatis disembunyikan, rating 4-5 otomatis tayang.
        </p>
      </div>

      {/* Desktop: table */}
      <Card className="overflow-hidden p-0 hidden sm:block">
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
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Tidak ada testimoni</p>
        ) : (
          data.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{t.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.product.title}</p>
                  </div>
                  <Badge variant={t.isPublished ? "completed" : "warning"} className="shrink-0">
                    {t.isPublished ? "Tayang" : "Disembunyikan"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <RatingStars rating={t.rating} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{t.message}</p>
                <div className="flex items-center justify-end gap-1 pt-1 border-t">
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
