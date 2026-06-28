import { useState, useEffect, useRef, useMemo } from "react"
import { useLocation, useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, X, Search, User, TrendingUp, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAlert } from "@/stores/alertStore"
import api from "@/lib/api"
import { formatIDR } from "@/lib/config"

interface Account {
  id: number
  username?: string
  email?: string
  capital?: number
  targetFollowers?: number
  currentFollowers?: number
  accountStatus?: string
  phoneModel?: string
}

interface Customer {
  id: number
  usernameSh?: string
  nomorHp?: string
}

interface AccountsResponse {
  accounts: Account[]
}

export default function AccountsPosPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const alert = useAlert()

  const initialIds: number[] = location.state?.selectedIds ?? []

  const [selectedIds, setSelectedIds] = useState<number[]>(initialIds)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearchQuery, setCustomerSearchQuery] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [isShopee, setIsShopee] = useState(false)
  const [shopeeOrderNumber, setShopeeOrderNumber] = useState("")
  const [totalSalesInput, setTotalSalesInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery<AccountsResponse>({
    queryKey: ["accounts-pos-items", initialIds],
    queryFn: () =>
      api.get("/management/accounts/sales-mobile", { params: { account_ids: initialIds.join(",") } }).then((r) => r.data),
    enabled: initialIds.length > 0,
  })

  const selected = (data?.accounts ?? []).filter((a) => selectedIds.includes(a.id))

  const totalSalePrice = parseInt(totalSalesInput.replace(/\D/g, "") || "0")
  const unitPrice = useMemo(() => {
    if (!totalSalesInput || selected.length === 0) return 0
    return Math.floor(totalSalePrice / selected.length)
  }, [totalSalePrice, selected.length])

  const totalCapital = selected.reduce((s, a) => s + (a.capital ?? 0), 0)
  const totalProfit = totalSalePrice - totalCapital

  useEffect(() => {
    api.get("/management/accounts/search/customers").then((r) => setCustomers(r.data?.customers ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      if (customerSearchQuery) {
        api.get("/management/accounts/search/customers", { params: { search: customerSearchQuery } })
          .then((r) => setCustomers(r.data?.customers ?? []))
          .catch(() => {})
      }
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearchQuery])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node))
        setShowCustomerDropdown(false)
    }
    if (showCustomerDropdown) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showCustomerDropdown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) { alert.error("Validasi", "Pilih customer"); return }
    if (selected.length === 0) { alert.error("Validasi", "Tidak ada akun dipilih"); return }
    if (!totalSalesInput.trim()) { alert.error("Validasi", "Masukkan harga jual"); return }
    setSubmitting(true)
    try {
      const salesNumber = `BUYMIUM${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Date.now().toString().slice(-3)}`
      await api.post("/management/sales", {
        sales_number: salesNumber,
        customer_id: selectedCustomer.id,
        total_sale_price: totalSalePrice,
        total_profit: totalProfit,
        is_shopee: isShopee,
        shopee_order_number: isShopee ? shopeeOrderNumber : undefined,
        items: selected.map((a) => ({
          account_id: a.id,
          unit_sale_price: unitPrice,
          profit: unitPrice - (a.capital ?? 0),
        })),
      })
      alert.success("Berhasil", "Penjualan berhasil dibuat")
      navigate("/stock/accounts")
    } catch {
      alert.error("Gagal", "Gagal membuat penjualan")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold">Point of Sales</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col sm:grid sm:grid-cols-[1fr_380px] gap-6 min-h-0">
        {/* LEFT — Account list (order-2 on mobile, col-1 on desktop) */}
        <div className="flex flex-col min-h-0 order-2 sm:order-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Akun Dipilih ({selected.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {selected.length === 0 ? (
              <div className="flex items-center justify-center h-40 rounded-lg border border-dashed text-muted-foreground text-sm">
                Tidak ada akun dipilih
              </div>
            ) : selected.map((acc) => {
              const profit = unitPrice - (acc.capital ?? 0)
              return (
                <div key={acc.id} className="rounded-lg border bg-card p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{acc.username ?? acc.email ?? "-"}</span>
                      {acc.accountStatus && (
                        <Badge variant={acc.accountStatus === "Completed" ? "completed" : "progress"} className="shrink-0 text-xs">
                          {acc.accountStatus}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Capital: {acc.capital != null ? formatIDR(acc.capital) : "-"}</span>
                      <span>Followers: {acc.currentFollowers?.toLocaleString("id-ID") ?? "-"}</span>
                      {acc.phoneModel && <span className="flex items-center gap-1"><svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg>{acc.phoneModel}</span>}
                    </div>
                    {totalSalesInput && (
                      <div className="flex gap-4 text-xs pt-1">
                        <span className="text-muted-foreground">Harga: <span className="font-medium text-foreground">{formatIDR(unitPrice)}</span></span>
                        <span className={profit >= 0 ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>
                          Profit: {formatIDR(profit)}
                        </span>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setSelectedIds((p) => p.filter((x) => x !== acc.id))}
                    className="shrink-0 rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT — Checkout panel (order-1 on mobile, col-2 on desktop) */}
        <div className="flex flex-col gap-4 order-1 sm:order-2">
          {/* Customer */}
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
                <Checkbox id="shopee" checked={isShopee} onCheckedChange={(v) => setIsShopee(!!v)} />
                <label htmlFor="shopee" className="text-sm cursor-pointer">Via Shopee</label>
              </div>
              {isShopee && (
                <Input placeholder="Nomor order Shopee..." value={shopeeOrderNumber}
                  onChange={(e) => setShopeeOrderNumber(e.target.value)} />
              )}
            </CardContent>
          </Card>

          {/* Total Sales */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><Wallet className="size-4" /> Total Harga Jual *</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Input type="text" inputMode="numeric" placeholder="0"
                value={totalSalesInput ? totalSalePrice.toLocaleString("id-ID") : ""}
                onChange={(e) => setTotalSalesInput(e.target.value.replace(/\D/g, ""))}
                className="text-lg font-semibold" />
              {selected.length > 1 && totalSalesInput && (
                <p className="text-xs text-muted-foreground mt-1.5">per akun: {formatIDR(unitPrice)}</p>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          {totalSalesInput && selected.length > 0 && (
            <Card className="bg-muted/40">
              <CardContent className="px-4 py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Harga Jual</span>
                  <span className="font-medium">{formatIDR(totalSalePrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Modal</span>
                  <span className="font-medium">{formatIDR(totalCapital)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="font-semibold flex items-center gap-1.5"><TrendingUp className="size-3.5" /> Total Profit</span>
                  <span className={`font-bold text-base ${totalProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatIDR(totalProfit)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Button type="submit" size="lg" className="w-full mt-auto"
            disabled={submitting || selected.length === 0 || !selectedCustomer || !totalSalesInput}>
            {submitting ? "Memproses..." : `Submit Sales (${selected.length} akun)`}
          </Button>
        </div>
      </form>
    </div>
  )
}
