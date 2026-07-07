import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Save, Loader2, Plus, Trash2, ImagePlus, X, ShieldCheck, Star, ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"

const variantSchema = z.object({
  name: z.string().min(1, "Nama opsi wajib diisi"),
  price: z.number().min(0),
})

const schema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  description: z.string().optional(),
  tags: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.number().min(0),
  inStock: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
  hasVariants: z.boolean().default(false),
  variantLabel: z.string().optional(),
  variants: z.array(variantSchema).optional(),
})

type FormData = {
  title: string
  description?: string
  tags?: string
  imageUrl?: string
  price: number
  inStock?: number
  rating?: number
  isVerified: boolean
  isActive: boolean
  hasVariants: boolean
  variantLabel?: string
  variants?: { name: string; price: number }[]
}

interface ProductVariant {
  id: number
  name: string
  price: number
  availableStock?: number
}

interface Product {
  id: number
  title: string
  description?: string
  tags?: string
  imageUrl?: string
  price: number
  inStock?: number
  rating?: number
  isVerified?: boolean
  isActive?: boolean
  variantLabel?: string
  variants?: ProductVariant[]
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const alert = useAlert()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data),
    enabled: isEdit,
  })

  const {
    register,
    control,
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
      imageUrl: "",
      price: 0,
      inStock: 0,
      rating: 0,
      isVerified: false,
      isActive: true,
      hasVariants: false,
      variantLabel: "",
      variants: [],
    },
  })

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: "variants",
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
        imageUrl: product.imageUrl ?? "",
        price: product.price,
        inStock: product.inStock ?? 0,
        rating: product.rating ?? 0,
        isVerified: product.isVerified ?? false,
        isActive: product.isActive ?? true,
        hasVariants: (product.variants ?? []).length > 0,
        variantLabel: product.variantLabel ?? "",
        variants: (product.variants ?? []).map((v) => ({ name: v.name, price: v.price })),
      })
    }
  }, [product, reset])

  const handlePickImage = () => fileInputRef.current?.click()

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!file) return

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await api.post("/products/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setValue("imageUrl", res.data.url, { shouldValidate: true })
    } catch {
      alert.error("Gagal", "Gagal mengunggah foto produk")
    } finally {
      setUploadingImage(false)
    }
  }

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { variants, hasVariants, variantLabel, ...rest } = data
      const tagsArray = rest.tags
        ? rest.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : []
      const activeVariants = hasVariants ? (variants ?? []).filter((v) => v.name.trim()) : []

      const payload = {
        ...rest,
        tags: tagsArray,
        // Keep the base price meaningful for listings even when variants carry the real prices
        price: activeVariants.length > 0 ? Math.min(...activeVariants.map((v) => v.price)) : rest.price,
      }

      const res = isEdit
        ? await api.patch(`/products/${id}`, payload)
        : await api.post("/products", payload)

      const productId = isEdit ? id : res.data.id
      await api.put(`/products/${productId}/variants`, {
        variantLabel: hasVariants ? (variantLabel || null) : null,
        variants: activeVariants,
      })

      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["product", id] })
      alert.success("Berhasil", isEdit ? "Produk berhasil diperbarui" : "Produk berhasil ditambahkan")
      navigate("/ecommerce/products")
    },
    onError: () => alert.error("Gagal", "Gagal menyimpan produk"),
  })

  const priceValue = watch("price")
  const inStockValue = watch("inStock")
  const imageUrl = watch("imageUrl")
  const hasVariants = watch("hasVariants")
  const ratingValue = watch("rating")
  const watchedVariants = watch("variants")
  const activeVariants = hasVariants ? (watchedVariants ?? []).filter((v) => v.name?.trim()) : []
  const activeVariantCount = activeVariants.length
  const previewPrice = activeVariantCount > 0 ? Math.min(...activeVariants.map((v) => v.price || 0)) : priceValue
  const tagList = (watch("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean)

  if (isEdit && isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_320px] gap-6">
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
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-4">
          {/* Photo card */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="size-5 rounded bg-purple-600 text-white flex items-center justify-center text-xs">🖼️</span>
                Foto Produk
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageSelected}
              />
              {imageUrl ? (
                <div className="relative w-full max-w-xs">
                  <img
                    src={imageUrl}
                    alt="Foto produk"
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 size-7 shadow"
                    onClick={() => setValue("imageUrl", "")}
                  >
                    <X className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-2"
                    onClick={handlePickImage}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                    Ganti Foto
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer text-center border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors max-w-xs"
                  onClick={handlePickImage}
                >
                  {uploadingImage ? (
                    <Loader2 className="size-8 text-muted-foreground mb-2 animate-spin" />
                  ) : (
                    <ImagePlus className="size-8 text-muted-foreground mb-2" />
                  )}
                  <p className="text-sm font-medium">Klik untuk unggah foto</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, atau WEBP, maks 5MB</p>
                </div>
              )}
            </CardContent>
          </Card>

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
                <Label htmlFor="tags">Tag / Kata Kunci <span className="text-muted-foreground font-normal">(pisahkan dengan koma)</span></Label>
                <Input
                  id="tags"
                  {...register("tags")}
                  placeholder="pilih kategori yang relevan: netflix, premium, lifetime..."
                />
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
            </CardContent>
          </Card>

          {/* Variation toggle card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="hasVariants" className="cursor-pointer">Aktifkan Variasi</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aktifkan untuk membuat beberapa pilihan harga, mis. berdasarkan jumlah followers atau durasi.
                  </p>
                </div>
                <Switch
                  id="hasVariants"
                  checked={hasVariants}
                  onCheckedChange={(v) => setValue("hasVariants", v)}
                />
              </div>

              {hasVariants && (
                <div className="space-y-3 pt-1 border-t">
                  <div className="space-y-1.5 pt-3">
                    <Label htmlFor="variantLabel">Variasi</Label>
                    <Input
                      id="variantLabel"
                      {...register("variantLabel")}
                      placeholder='Nama variasi, mis. "Jumlah"'
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Opsi</Label>
                    <div className="space-y-2">
                      {variantFields.map((field, index) => {
                        const variantPrice = watch(`variants.${index}.price`)
                        return (
                          <div key={field.id} className="flex items-start gap-2">
                            <div className="flex-1 space-y-1.5">
                              <Input
                                {...register(`variants.${index}.name`)}
                                placeholder='Nama opsi, mis. "1.000+ Followers"'
                              />
                              {errors.variants?.[index]?.name && (
                                <p className="text-xs text-destructive">{errors.variants[index]?.name?.message}</p>
                              )}
                            </div>
                            <div className="w-40 space-y-1.5">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={variantPrice ? variantPrice.toLocaleString("id-ID") : ""}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "")
                                  setValue(`variants.${index}.price`, raw ? parseInt(raw, 10) : 0, { shouldValidate: true })
                                }}
                                placeholder="Harga"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 text-destructive hover:text-destructive shrink-0"
                              onClick={() => removeVariant(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => appendVariant({ name: "", price: 0 })}
                    >
                      <Plus className="size-4" />
                      Tambah Opsi
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing card (fallback price when no variations) */}
          {!hasVariants && (
            <Card>
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="size-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs">💰</span>
                  Harga & Inventaris
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Harga Satuan (IDR)</Label>
                  <Input
                    id="price"
                    type="text"
                    inputMode="numeric"
                    value={priceValue ? priceValue.toLocaleString("id-ID") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "")
                      setValue("price", raw ? parseInt(raw, 10) : 0, { shouldValidate: true })
                    }}
                    placeholder="0"
                  />
                  {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rating">Rating (0.0 - 5.0)</Label>
                  <Input id="rating" type="number" step="0.1" min="0" max="5" {...register("rating", { valueAsNumber: true })} placeholder="0.0" />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="isVerified"
              checked={!!watch("isVerified")}
              onCheckedChange={(v) => setValue("isVerified", !!v)}
            />
            <Label htmlFor="isVerified" className="cursor-pointer font-normal">Produk Terverifikasi</Label>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" className="gap-2" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending)
                ? <Loader2 className="size-4 animate-spin" />
                : <Save className="size-4" />}
              {isEdit ? "Simpan Perubahan" : "Terbitkan Produk"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/ecommerce/products")}
            >
              Batalkan
            </Button>
          </div>
        </div>

        {/* Right column: mobile preview */}
        <div className="space-y-3 sm:sticky sm:top-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm">Preview Tampilan Mobile</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="mx-auto w-[260px] rounded-[2rem] border-8 border-neutral-900 bg-neutral-900 shadow-xl">
                <div className="rounded-[1.5rem] bg-background overflow-hidden">
                  <div className="h-5 flex items-center justify-center bg-background">
                    <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                  </div>
                  <div className="p-3">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <div className="mb-2 aspect-square w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                        {imageUrl ? (
                          <img src={imageUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <ImageOff className="size-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <h4 className="text-xs font-medium leading-snug line-clamp-2">
                          {watch("title") || "Nama produk"}
                        </h4>
                        {watch("isVerified") && (
                          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">
                          {previewPrice > 0
                            ? `${hasVariants && activeVariantCount > 1 ? "Mulai " : ""}Rp ${previewPrice.toLocaleString("id-ID")}`
                            : "Hubungi kami"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {hasVariants ? `${activeVariantCount} opsi` : `${inStockValue ?? 0} stok`}
                        </span>
                      </div>
                      {!!ratingValue && (
                        <div className="mt-1.5 flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`size-3 ${s <= Math.round(ratingValue) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                            />
                          ))}
                        </div>
                      )}
                      {tagList.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tagList.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Simulasi tampilan kartu produk di katalog storefront.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
