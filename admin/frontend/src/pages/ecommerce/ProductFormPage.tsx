import { useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"

const schema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  description: z.string().optional(),
  tags: z.string().optional(),
  price: z.number().min(0),
  inStock: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

type FormData = {
  title: string
  description?: string
  tags?: string
  price: number
  inStock?: number
  rating?: number
  isVerified: boolean
  isActive: boolean
}

interface Product {
  id: number
  title: string
  description?: string
  tags?: string
  price: number
  inStock?: number
  rating?: number
  isVerified?: boolean
  isActive?: boolean
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const alert = useAlert()

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data),
    enabled: isEdit,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      title: "",
      description: "",
      tags: "",
      price: 0,
      inStock: 0,
      rating: 0,
      isVerified: false,
      isActive: true,
    },
  })

  useEffect(() => {
    if (product) {
      const rawTags = product.tags
      let tagsStr = ""
      try {
        const parsed = JSON.parse(rawTags ?? "[]")
        tagsStr = Array.isArray(parsed) ? parsed.join(", ") : String(rawTags ?? "")
      } catch {
        tagsStr = rawTags ?? ""
      }
      reset({
        title: product.title,
        description: product.description ?? "",
        tags: tagsStr,
        price: product.price,
        inStock: product.inStock ?? 0,
        rating: product.rating ?? 0,
        isVerified: product.isVerified ?? false,
        isActive: product.isActive ?? true,
      })
    }
  }, [product, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const tagsArray = data.tags
        ? data.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : []
      const payload = {
        ...data,
        tags: tagsArray,
      }
      return isEdit
        ? api.put(`/products/${id}`, payload)
        : api.post("/products", payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["product", id] })
      alert.success("Berhasil", isEdit ? "Produk berhasil diperbarui" : "Produk berhasil ditambahkan")
      navigate("/ecommerce/products")
    },
    onError: () => alert.error("Gagal", "Gagal menyimpan produk"),
  })

  if (isEdit && isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-4">
          {/* Title & Description card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Nama Produk</Label>
                <Input
                  id="title"
                  {...register("title")}
                  placeholder="Ketik nama produk yang menarik..."
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Deskripsi Lengkap</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  rows={12}
                  className="resize-y font-normal text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tags">Tag / Kata Kunci <span className="text-muted-foreground font-normal">(pisahkan dengan koma)</span></Label>
                <Input
                  id="tags"
                  {...register("tags")}
                  placeholder="pilih kategori yang relevan: netflix, premium, lifetime..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing card */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="size-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs">💰</span>
                Harga & Inventaris
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Harga Satuan (IDR)</Label>
                  <Input id="price" type="number" {...register("price", { valueAsNumber: true })} placeholder="0" />
                  {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inStock">Stok Tersedia (pcs)</Label>
                  <Input id="inStock" type="number" {...register("inStock", { valueAsNumber: true })} placeholder="0" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rating">Rating (0.0 - 5.0)</Label>
                <Input id="rating" type="number" step="0.1" min="0" max="5" {...register("rating", { valueAsNumber: true })} placeholder="0.0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isVerified"
                  checked={!!watch("isVerified")}
                  onCheckedChange={(v) => setValue("isVerified", !!v)}
                />
                <Label htmlFor="isVerified" className="cursor-pointer font-normal">Produk Terverifikasi</Label>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isSubmitting || mutation.isPending}>
                {(isSubmitting || mutation.isPending)
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Save className="size-4" />}
                {isEdit ? "Simpan Perubahan" : "Terbitkan Produk"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/ecommerce/products")}
              >
                Batalkan
              </Button>
            </CardContent>
          </Card>

          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Info:</strong> Produk dijual dengan satuan <strong>per pcs</strong> secara default.
            </p>
          </div>
        </div>
      </div>
    </form>
  )
}
