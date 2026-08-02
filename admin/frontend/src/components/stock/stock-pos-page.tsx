import { ArrowLeft, X, Search, User, TrendingUp, Wallet } from "lucide-react"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatIDR } from "@/lib/config"
import { useStockPos, type StockPosConfig, type StockPosItem } from "@/hooks/use-stock-pos"

export interface StockPosPageConfig extends StockPosConfig {
  /** Value of `accountStatus` that renders the "completed" badge variant, e.g. "Completed" | "completed" */
  completedStatusValue: string
  /** Extra spans rendered in the Capital/Followers row after the Followers span (e.g. phone model) */
  renderFollowers: (item: StockPosItem) => React.ReactNode
  /** Optional extra label rendered in the header row next to the status badge (e.g. year) */
  renderHeaderExtra?: (item: StockPosItem) => React.ReactNode
  /** Customer search dropdown positioning: accounts uses an inline relative dropdown, accsmarket a fixed one anchored to the input */
  dropdownVariant: "inline" | "fixed"
  /** Whether unchecking "Via Shopee" also clears the order number input */
  clearShopeeOrderOnUncheck: boolean
  /** Layout order of the Summary card relative to the Submit button */
  summaryPosition: "before-submit" | "after-submit"
  /** Placeholder text for the Shopee order-number input */
  shopeeOrderPlaceholder: string
}

/**
 * Shared POS page UI for the "stock" entities (accounts / accsmarket). Structure, copy, and
 * behaviour are identical between the two; only status badge value, followers formatting, an
 * optional extra badge, the customer-dropdown positioning strategy, shopee-checkbox behaviour,
 * and summary/submit ordering differ — all parameterized via `config`.
 */
export function StockPosPage({ config }: { config: StockPosPageConfig }) {
  const navigate = useNavigate()
  const {
    customers, customerSearchQuery, setCustomerSearchQuery,
    selectedCustomer, setSelectedCustomer,
    showCustomerDropdown, setShowCustomerDropdown,
    isShopee, setIsShopee,
    shopeeOrderNumber, setShopeeOrderNumber,
    totalSalesInput, setTotalSalesInput,
    submitting,
    customerDropdownRef, customerInputWrapRef,
    selected,
    totalSalePrice, unitPrice, totalCapital, totalProfit,
    handleSubmit,
    setSelectedIds,
  } = useStockPos(config)

  const customerDropdownList = (
    customers.length === 0
      ? <p className="text-xs text-muted-foreground p-3">Tidak ada customer</p>
      : customers.map((c) => (
        <button key={c.id} type="button"
          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
          onClick={() => { setSelectedCustomer(c); setCustomerSearchQuery(""); setShowCustomerDropdown(false) }}>
          <p className="font-medium">{c.usernameSh ?? "-"}</p>
          {c.nomorHp && <p className="text-xs text-muted-foreground">{c.nomorHp}</p>}
        </button>
      ))
  )

  const summaryCard = totalSalesInput && selected.length > 0 && (
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
  )

  const submitButton = (
    <Button type="submit" size="lg" className={`w-full ${config.summaryPosition === "before-submit" ? "mt-auto" : ""}`}
      disabled={submitting || selected.length === 0 || !selectedCustomer || !totalSalesInput}>
      {submitting ? "Memproses..." : `Submit Sales (${selected.length} akun)`}
    </Button>
  )

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
                        <Badge variant={acc.accountStatus === config.completedStatusValue ? "completed" : "progress"} className="shrink-0 text-xs">
                          {acc.accountStatus}
                        </Badge>
                      )}
                      {config.renderHeaderExtra?.(acc)}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Capital: {acc.capital != null ? formatIDR(acc.capital) : "-"}</span>
                      {config.renderFollowers(acc)}
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
            <CardContent className={`px-4 pb-4 space-y-3 ${config.dropdownVariant === "fixed" ? "overflow-visible" : ""}`}>
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
                ) : config.dropdownVariant === "fixed" ? (
                  <>
                    <div ref={customerInputWrapRef} className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input placeholder="Cari customer..." value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        onFocus={() => setShowCustomerDropdown(true)} className="pl-9" />
                    </div>
                    {showCustomerDropdown && (() => {
                      const rect = customerInputWrapRef.current?.getBoundingClientRect()
                      return (
                        <div className="fixed z-50 rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto"
                          style={{ top: rect ? rect.bottom + 4 : 0, left: rect ? rect.left : 0, width: rect ? rect.width : "auto" }}>
                          {customerDropdownList}
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input placeholder="Cari customer..." value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      onFocus={() => setShowCustomerDropdown(true)} className="pl-9" />
                    {showCustomerDropdown && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                        {customerDropdownList}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox id="shopee" checked={isShopee}
                  onCheckedChange={(v) => {
                    setIsShopee(!!v)
                    if (config.clearShopeeOrderOnUncheck && !v) setShopeeOrderNumber("")
                  }} />
                <label htmlFor="shopee" className="text-sm cursor-pointer">Via Shopee</label>
              </div>
              {isShopee && (
                <Input placeholder={config.shopeeOrderPlaceholder} value={shopeeOrderNumber}
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

          {config.summaryPosition === "before-submit" ? (
            <>
              {summaryCard}
              {submitButton}
            </>
          ) : (
            <>
              {submitButton}
              {summaryCard}
            </>
          )}
        </div>
      </form>
    </div>
  )
}
