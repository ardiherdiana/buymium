import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, X, Search, User, Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"
import { useCustomerSearch } from "@/hooks/use-customer-search"

interface Customer {
  id: number
  usernameSh?: string
  nomorHp?: string
}

interface VendorTier { id: number; name: string; target_followers: number; price: number }
interface Vendor {
  id: number
  name: string
  is_active: boolean
  tiers: VendorTier[]
}

interface Row {
  key: number
  username: string
  vendorTierId: string
}

let rowKeySeq = 0
const newRow = (): Row => ({ key: rowKeySeq++, username: "", vendorTierId: "" })

export default function UpfollOrderFormPage() {
  const navigate = useNavigate()
  const alert = useAlert()

  const [rows, setRows] = useState<Row[]>([newRow()])
  const { customers, searchQuery: customerSearchQuery, setSearchQuery: setCustomerSearchQuery } =
    useCustomerSearch("/management/accounts/search/customers")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [isShopee, setIsShopee] = useState(false)
  const [shopeeOrderNumber, setShopeeOrderNumber] = useState("")
  const [totalSalesInput, setTotalSalesInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  const { data: vendorsData } = useQuery<{ vendors: Vendor[] }>({
    queryKey: ["upfoll-vendors"],
    queryFn: () => api.get("/management/upfoll-vendors").then((r) => r.data),
  })
  const vendors = vendorsData?.vendors ?? []

  // Cheapest tier per follower target across all active vendors — orders pick
  // directly from this list, no vendor selection step needed.
  const bestTiers = useMemo(() => {
    const map = new Map<number, { tierId: number; targetFollowers: number; price: number; vendorName: string }>()
    for (const v of vendors) {
      if (!v.is_active) continue
      for (const t of v.tiers) {
        const existing = map.get(t.target_followers)
        if (!existing || t.price < existing.price) {
          map.set(t.target_followers, { tierId: t.id, targetFollowers: t.target_followers, price: t.price, vendorName: v.name })
        }
      }
    }
    return [...map.values()].sort((a, b) => a.targetFollowers - b.targetFollowers)
  }, [vendors])

  const allTiers = useMemo(() => vendors.flatMap((v) => v.tiers.map((t) => ({ ...t, vendorId: v.id }))), [vendors])

  const validRows = rows.filter((r) => r.username.trim() && r.vendorTierId)
  const totalSalePrice = parseInt(totalSalesInput.replace(/\D/g, "") || "0")
  const unitPrice = useMemo(() => {
    if (!totalSalesInput || validRows.length === 0) return 0
    return Math.floor(totalSalePrice / validRows.length)
  }, [totalSalePrice, validRows.length, totalSalesInput])

  const capitalFor = (vendorTierId: string) =>
    allTiers.find((t) => String(t.id) === vendorTierId)?.price ?? null

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node))
        setShowCustomerDropdown(false)
    }
    if (showCustomerDropdown) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showCustomerDropdown])

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const removeRow = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key))
  const addRow = () => setRows((rs) => [...rs, newRow()])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) { alert.error("Validasi", "Pilih customer"); return }
    if (validRows.length === 0) { alert.error("Validasi", "Tambahkan minimal 1 username IG dengan tier"); return }
    if (!totalSalesInput.trim()) { alert.error("Validasi", "Masukkan total harga jual"); return }

    setSubmitting(true)
    try {
      await api.post("/management/upfoll-orders", {
        customer_id: selectedCustomer.id,
        total_sale_price: totalSalePrice,
        is_shopee: isShopee,
        shopee_order_number: isShopee ? shopeeOrderNumber : undefined,
        items: validRows.map((r) => ({
          username: r.username.trim().replace(/^@/, ""),
          vendor_tier_id: parseInt(r.vendorTierId),
        })),
      })
      alert.success("Berhasil", "Pesanan upfoll berhasil dibuat")
      navigate("/upfoll/orders")
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal membuat pesanan"
      alert.error("Gagal", msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold">Buat Pesanan Upfoll</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col sm:grid sm:grid-cols-[1fr_380px] gap-6 min-h-0">
        {/* LEFT — username rows */}
        <div className="flex flex-col min-h-0 order-2 sm:order-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Username IG ({validRows.length})</h2>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-3.5 mr-1" /> Tambah Baris
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {rows.map((row) => {
              const capital = row.vendorTierId ? capitalFor(row.vendorTierId) : null
              const profit = capital != null && totalSalesInput ? unitPrice - capital : null
              return (
                <div key={row.key} className="rounded-lg border bg-card p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <Input
                      placeholder="username_instagram"
                      value={row.username}
                      onChange={(e) => updateRow(row.key, { username: e.target.value })}
                    />
                    <Select value={row.vendorTierId} onValueChange={(v) => updateRow(row.key, { vendorTierId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih tier (termurah)" />
                      </SelectTrigger>
                      <SelectContent>
                        {!bestTiers.length ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Belum ada vendor/tier aktif</div>
                        ) : bestTiers.map((t) => (
                          <SelectItem key={t.tierId} value={String(t.tierId)}>
                            {t.targetFollowers.toLocaleString("id-ID")} followers — {formatIDR(t.price)} ({t.vendorName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {totalSalesInput && capital != null && (
                      <div className="flex gap-4 text-xs">
                        <span className="text-muted-foreground">Harga: <span className="font-medium text-foreground">{formatIDR(unitPrice)}</span></span>
                        <span className={(profit ?? 0) >= 0 ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>
                          Profit: {formatIDR(profit ?? 0)}
                        </span>
                      </div>
                    )}
                  </div>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(row.key)}
                      className="shrink-0 rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT — checkout panel */}
        <div className="flex flex-col gap-4 order-1 sm:order-2">
          <Card className="overflow-visible">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><User className="size-4" /> Customer *</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div ref={customerDropdownRef} className="relative">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{selectedCustomer.usernameSh}</p>
                      {selectedCustomer.nomorHp && <p className="text-xs text-muted-foreground">{selectedCustomer.nomorHp}</p>}
                    </div>
                    <button type="button" onClick={() => setSelectedCustomer(null)} className="rounded hover:bg-muted p-0.5 ml-2">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input placeholder="Cari customer..." value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      onFocus={() => setShowCustomerDropdown(true)} className="pl-9" />
                    {showCustomerDropdown && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                        {customers.length === 0
                          ? <p className="text-xs text-muted-foreground p-3">Tidak ada customer</p>
                          : customers.map((c) => (
                            <button key={c.id} type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => { setSelectedCustomer(c); setCustomerSearchQuery(""); setShowCustomerDropdown(false) }}>
                              <p className="font-medium">{c.usernameSh ?? "-"}</p>
                              {c.nomorHp && <p className="text-xs text-muted-foreground">{c.nomorHp}</p>}
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox id="upfoll-shopee" checked={isShopee} onCheckedChange={(v) => setIsShopee(!!v)} />
                <label htmlFor="upfoll-shopee" className="text-sm cursor-pointer">Via Shopee</label>
              </div>
              {isShopee && (
                <Input placeholder="Nomor order Shopee..." value={shopeeOrderNumber}
                  onChange={(e) => setShopeeOrderNumber(e.target.value)} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><Wallet className="size-4" /> Total Harga Jual *</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Input type="text" inputMode="numeric" placeholder="0"
                value={totalSalesInput ? totalSalePrice.toLocaleString("id-ID") : ""}
                onChange={(e) => setTotalSalesInput(e.target.value.replace(/\D/g, ""))}
                className="text-lg font-semibold" />
              {validRows.length > 1 && totalSalesInput && (
                <p className="text-xs text-muted-foreground mt-1.5">per username: {formatIDR(unitPrice)}</p>
              )}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full mt-auto"
            disabled={submitting || validRows.length === 0 || !selectedCustomer || !totalSalesInput}>
            {submitting ? "Memindai followers & membuat pesanan..." : `Buat Pesanan (${validRows.length} username)`}
          </Button>
          {submitting && (
            <p className="text-xs text-muted-foreground text-center -mt-2">
              Setiap username di-scan dulu untuk followers awal, mohon tunggu...
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
