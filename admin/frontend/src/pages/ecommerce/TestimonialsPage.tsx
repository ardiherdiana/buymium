import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, X, Star, Plus } from "lucide-react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
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

interface Product {
  id: number
  title: string
}

interface FormValues {
  productId: string
  customerName: string
  message: string
  rating: string
  avatar: string
  isPublished: boolean
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

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const v = i + 1
        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHovered(v)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(v)}
          >
            <Star
              className={`size-6 transition-colors ${
                v <= (hovered || value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

export default function TestimonialsPage() {
  const queryClient = useQueryClient()
  const alert = useAlert()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { productId: "", customerName: "", message: "", rating: "5", avatar: "", isPublished: true },
  })

  const { data, isLoading } = useQuery<Testimonial[]>({
    queryKey: ["testimonials"],
    queryFn: () => api.get("/testimonials").then((r) => r.data),
  })

  const { data: products } = useQuery<Product[]>({
    queryKey: ["products-simple"],
    queryFn: () => api.get("/products", { params: { limit: 100 } }).then((r) => r.data?.data ?? r.data),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/testimonials", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] })
      alert.success("Berhasil", "Testimoni berhasil ditambahkan")
      setOpen(false)
      reset()
      setRating(5)
    },
    onError: () => alert.error("Gagal", "Gagal menambahkan testimoni"),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      api.patch(`/testimonials/${id}`, { isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] })
      alert.success("Berhasil", "Testimoni berhasil diperbarui")
    },
    onError: () => alert.error("Gagal", "Gagal memperbarui testimoni"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/testimonials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testimonials"] })
      alert.success("Berhasil", "Testimoni berhasil dihapus")
    },
    onError: () => alert.error("Gagal", "Gagal menghapus testimoni"),
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate({
      productId: parseInt(values.productId),
      customerName: values.customerName,
      message: values.message,
      rating,
      avatar: values.avatar || undefined,
      isPublished: values.isPublished,
    })
  }

  const handlePublish = (id: number, publish: boolean) =>
    toggleMutation.mutate({ id, isPublished: publish })

  const handleDelete = async (t: Testimonial) => {
    const ok = await alert.confirm("Hapus Testimoni", `Hapus testimoni dari "${t.customerName}"?`)
    if (ok) deleteMutation.mutate(t.id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Testimoni</h1>
          <p className="text-sm text-muted-foreground mt-1">Ulasan produk dari pelanggan</p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="size-4 mr-1" />
          Tambah
        </Button>
      </div>

      {/* Dialog Form */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { reset(); setRating(5) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Testimoni</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Produk <span className="text-destructive">*</span></Label>
              <Select onValueChange={(v) => setValue("productId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih produk..." />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.productId && <p className="text-xs text-destructive">Produk wajib dipilih</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Nama Pelanggan <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Nama pelanggan..."
                {...register("customerName", { required: true })}
              />
              {errors.customerName && <p className="text-xs text-destructive">Nama wajib diisi</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Rating</Label>
              <StarPicker value={rating} onChange={setRating} />
            </div>

            <div className="space-y-1.5">
              <Label>Pesan <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Tulis testimoni..."
                rows={3}
                {...register("message", { required: true })}
              />
              {errors.message && <p className="text-xs text-destructive">Pesan wajib diisi</p>}
            </div>

            <div className="space-y-1.5">
              <Label>URL Foto Profil <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Input placeholder="https://..." {...register("avatar")} />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublished"
                defaultChecked
                className="size-4 accent-primary"
                {...register("isPublished")}
              />
              <Label htmlFor="isPublished" className="font-normal cursor-pointer">Langsung tayangkan</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
