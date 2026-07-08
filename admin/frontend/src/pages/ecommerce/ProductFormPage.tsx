import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Save, Loader2, ImagePlus, X, ShieldCheck, Star, ImageOff, Search, Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"

const variantSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  targetFollowers: z.number().nullable(),
  count: z.number().optional(),
})

const schema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.number().min(0),
  rating: z.number().min(0).max(5).optional(),
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
  variants: z.array(variantSchema).optional(),
  sourceId: z.number({ error: "Source wajib dipilih" }),
})

type FormData = {
  title: string
  description?: string
  imageUrl?: string
  price: number
  rating?: number
  isVerified: boolean
  isActive: boolean
  variants?: { name: string; price: number; targetFollowers: number | null; count?: number }[]
  sourceId: number
}

interface SourceOption {
  id: number
  name: string
  is_accsmarket: boolean
  product?: { id: number; title: string } | null
}

interface ProductVariant {
  id: number
  name: string
  price: number
  targetFollowers?: number | null
  availableStock?: number
}

interface VariantCandidate {
  targetFollowers: number
  count: number
  suggestedName: string
}

interface Product {
  id: number
  title: string
  description?: string
  imageUrl?: string
  price: number
  inStock?: number
  rating?: number
  isVerified?: boolean
  isActive?: boolean
  variants?: ProductVariant[]
  sourceId?: number | null
  source?: { id: number; name: string } | null
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const alert = useAlert()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedSource, setSelectedSource] = useState<SourceOption | null>(null)
  const [sourceSearch, setSourceSearch] = useState("")
  const [sourceResults, setSourceResults] = useState<SourceOption[]>([])
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)
  const [detectingVariants, setDetectingVariants] = useState(false)
  const sourceDropdownRef = useRef<HTMLDivElement>(null)
  const sourceInputWrapRef = useRef<HTMLDivElement>(null)

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
      imageUrl: "",
      price: 0,
      rating: 0,
      isVerified: false,
      isActive: true,
      variants: [],
    },
  })

  const { fields: variantFields, replace: replaceVariants, remove: removeVariant } = useFieldArray({
    control,
    name: "variants",
  })

  // Auto-detects price-tier candidates (distinct targetFollowers among "Selesai" accounts)
  // for the selected Source, and merges in any price already saved for that tier.
  async function loadVariantCandidates(sourceId: number, existing: ProductVariant[] = []) {
    setDetectingVariants(true)
    try {
      const res = await api.get(`/products/sources/${sourceId}/detect-variants`)
      const candidates: VariantCandidate[] = res.data?.data ?? []
      replaceVariants(
        candidates.map((c) => {
          const match = existing.find((v) => v.targetFollowers === c.targetFollowers)
          return {
            name: match?.name ?? c.suggestedName,
            price: match?.price ?? 0,
            targetFollowers: c.targetFollowers,
            count: c.count,
          }
        })
      )
    } catch {
      replaceVariants([])
    } finally {
      setDetectingVariants(false)
    }
  }

  useEffect(() => {
    if (product) {
      reset({
        title: product.title,
        description: product.description ?? "",
        imageUrl: product.imageUrl ?? "",
        price: product.price,
        rating: product.rating ?? 0,
        isVerified: product.isVerified ?? false,
        isActive: product.isActive ?? true,
        variants: [],
        sourceId: product.sourceId ?? undefined,
      })
      setSelectedSource(product.source ? { id: product.source.id, name: product.source.name, is_accsmarket: false } : null)
      // Show already-saved variants as-is; only re-detect from the Source when the admin
      // explicitly clicks "Refresh" (auto-fetching on every visit kept resurrecting opsi
      // that were intentionally deleted).
      replaceVariants(
        (product.variants ?? []).map((v) => ({
          name: v.name,
          price: v.price,
          targetFollowers: v.targetFollowers ?? null,
          count: v.availableStock,
        }))
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, reset])

  function handleRefreshVariants() {
    if (!selectedSource) return
    const currentVariants = (watch("variants") ?? []).map((v, i) => ({
      id: i,
      name: v.name,
      price: v.price,
      targetFollowers: v.targetFollowers,
    }))
    loadVariantCandidates(selectedSource.id, currentVariants)
  }

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/management/sources", { params: { search: sourceSearch, limit: 20 } })
        .then((r) => setSourceResults(r.data?.sources ?? []))
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [sourceSearch])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target as Node)) setShowSourceDropdown(false)
    }
    if (showSourceDropdown) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showSourceDropdown])

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
      const { variants, ...rest } = data
      const activeVariants = variants ?? []

      const payload = {
        ...rest,
        // Keep the base price meaningful for listings even when variants carry the real prices
        price: activeVariants.length > 0 ? Math.min(...activeVariants.map((v) => v.price)) : rest.price,
      }

      const res = isEdit
        ? await api.patch(`/products/${id}`, payload)
        : await api.post("/products", payload)

      const productId = isEdit ? id : res.data.id
      await api.put(`/products/${productId}/variants`, {
        variantLabel: null,
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
  const imageUrl = watch("imageUrl")
  const ratingValue = watch("rating")
  const watchedVariants = watch("variants") ?? []
  const activeVariantCount = watchedVariants.length
  const previewPrice = activeVariantCount > 0 ? Math.min(...watchedVariants.map((v) => v.price || 0)) : priceValue

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
          {/* Photo + title + description card */}
          <Card>
            <CardContent className="p-5 space-y-4">
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
            </CardContent>
          </Card>

          {/* Inventory source + price variations + rating card */}
          <Card>
            <CardContent className="p-5 space-y-5">
              <div className="space-y-2">
                <Label>Souce</Label>
                <div ref={sourceDropdownRef} className="relative">
                  {selectedSource ? (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                      <span className="text-sm font-medium">{selectedSource.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => {
                          setSelectedSource(null)
                          setValue("sourceId", undefined as unknown as number, { shouldValidate: true })
                          replaceVariants([])
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div ref={sourceInputWrapRef} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          placeholder="Cari source..."
                          value={sourceSearch}
                          onChange={(e) => setSourceSearch(e.target.value)}
                          onFocus={() => setShowSourceDropdown(true)}
                          className="pl-9"
                        />
                      </div>
                      {showSourceDropdown && (() => {
                        const rect = sourceInputWrapRef.current?.getBoundingClientRect()
                        return (
                          <div
                            className="fixed z-50 rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto"
                            style={{ top: (rect?.bottom ?? 0) + 4, left: rect?.left ?? 0, width: rect?.width ?? "auto" }}
                          >
                            {sourceResults.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-muted-foreground">Tidak ada source ditemukan</p>
                            ) : (
                              sourceResults.map((s) => {
                                const linkedElsewhere = !!s.product && s.product.id !== (product?.id ?? -1)
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    disabled={linkedElsewhere}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                                    onClick={() => {
                                      setSelectedSource(s)
                                      setValue("sourceId", s.id, { shouldValidate: true })
                                      setShowSourceDropdown(false)
                                      loadVariantCandidates(s.id)
                                    }}
                                  >
                                    <span>{s.name}</span>
                                    {linkedElsewhere && <span className="text-xs text-muted-foreground">sudah dipakai</span>}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>
                {errors.sourceId && <p className="text-xs text-destructive">{errors.sourceId.message}</p>}
              </div>

              {selectedSource && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label>Variasi Harga</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleRefreshVariants}
                      disabled={detectingVariants}
                    >
                      <RefreshCw className={`size-3.5 ${detectingVariants ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                  {detectingVariants ? (
                    <Skeleton className="h-16 w-full" />
                  ) : variantFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Tidak ada tingkatan followers terdeteksi di Source ini — produk akan pakai Harga Satuan di bawah.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {variantFields.map((field, index) => {
                        const variantPrice = watch(`variants.${index}.price`)
                        return (
                          <div key={field.id} className="flex items-center gap-2">
                            <div className="flex-1 text-sm">
                              {field.name}
                              <span className="ml-1.5 text-xs text-muted-foreground">({field.count ?? 0} akun tersedia)</span>
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
                              className="size-8 shrink-0 text-destructive hover:text-destructive"
                              title="Jangan jadikan variasi"
                              onClick={() => removeVariant(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {variantFields.length === 0 && (
                <div className="space-y-1.5 border-t pt-4">
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
              )}

              <div className="space-y-1.5 border-t pt-4">
                <Label htmlFor="rating">Rating (0.0 - 5.0)</Label>
                <Input id="rating" type="number" step="0.1" min="0" max="5" {...register("rating", { valueAsNumber: true })} placeholder="0.0" />
              </div>
            </CardContent>
          </Card>

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
        <div className="space-y-3 sm:sticky sm:top-4 sm:self-start">
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
                            ? `${activeVariantCount > 1 ? "Mulai " : ""}Rp ${previewPrice.toLocaleString("id-ID")}`
                            : "Hubungi kami"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {activeVariantCount > 0 ? `${activeVariantCount} opsi` : "stok otomatis"}
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
